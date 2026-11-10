const SOURCE_URL_ENV = 'PATCHING_CU_SOURCE_URL'
const SOURCE_USERNAME_ENV = 'PATCHING_CU_SOURCE_USERNAME'
const SOURCE_PASSWORD_ENV = 'PATCHING_CU_SOURCE_PASSWORD'
const REQUEST_TIMEOUT_MS = 10_000
const MAX_FIXLET_NAME_LENGTH = 512

/**
 * Error terklasifikasi milik adapter CU.
 * `code` dan `statusCode` boleh dipakai lapisan HTTP, sedangkan `cause` tetap internal agar
 * URL, credential, body vendor, dan detail jaringan tidak menjadi bagian kontrak browser.
 */
export class CuDashboardSourceError extends Error {
  constructor(code, statusCode, message, options) {
    super(message, options)
    this.name = 'CuDashboardSourceError'
    this.code = code
    this.statusCode = statusCode
  }
}

// Semua kegagalan schema vendor memakai satu kode supaya route tidak perlu memahami detail tuple.
function invalidPayload(message) {
  return new CuDashboardSourceError('UPSTREAM_INVALID_RESPONSE', 502, message)
}

/**
 * Membaca dan memvalidasi konfigurasi pada boundary backend setiap kali sumber akan dipanggil.
 * Environment adalah satu-satunya pemilik URL/credential; frontend dan payload API tidak boleh
 * menyediakan override karena hal itu dapat membocorkan secret atau membuka celah SSRF.
 *
 * @returns {{ sourceUrl: URL, headers: Record<string, string> }} Konfigurasi request yang aman.
 * @throws {CuDashboardSourceError} Jika URL atau pasangan Basic Auth tidak valid.
 */
function readSourceConfiguration() {
  const configuredUrl = process.env[SOURCE_URL_ENV]?.trim()
  if (!configuredUrl) {
    throw new CuDashboardSourceError(
      'CU_SOURCE_NOT_CONFIGURED',
      503,
      `${SOURCE_URL_ENV} belum dikonfigurasi.`,
    )
  }

  let sourceUrl
  try {
    sourceUrl = new URL(configuredUrl)
  } catch (error) {
    throw new CuDashboardSourceError(
      'CU_SOURCE_CONFIGURATION_INVALID',
      503,
      `${SOURCE_URL_ENV} bukan URL yang valid.`,
      { cause: error },
    )
  }

  if (!['http:', 'https:'].includes(sourceUrl.protocol) || sourceUrl.username || sourceUrl.password) {
    throw new CuDashboardSourceError(
      'CU_SOURCE_CONFIGURATION_INVALID',
      503,
      `${SOURCE_URL_ENV} harus berupa URL HTTP(S) tanpa credential tertanam.`,
    )
  }

  const username = process.env[SOURCE_USERNAME_ENV]?.trim() ?? ''
  const password = process.env[SOURCE_PASSWORD_ENV] ?? ''
  const hasUsername = username.length > 0
  const hasPassword = password.length > 0

  // Invariant: autentikasi selalu lengkap atau sepenuhnya anonim; tidak ada fallback diam-diam.
  if (hasUsername !== hasPassword) {
    throw new CuDashboardSourceError(
      'CU_SOURCE_AUTH_CONFIGURATION_INVALID',
      503,
      `${SOURCE_USERNAME_ENV} dan ${SOURCE_PASSWORD_ENV} harus dikonfigurasi berpasangan.`,
    )
  }

  const headers = { Accept: 'application/json' }
  if (hasUsername) {
    if (username.includes(':')) {
      throw new CuDashboardSourceError(
        'CU_SOURCE_AUTH_CONFIGURATION_INVALID',
        503,
        `${SOURCE_USERNAME_ENV} tidak boleh mengandung karakter titik dua.`,
      )
    }
    if (sourceUrl.protocol !== 'https:') {
      throw new CuDashboardSourceError(
        'CU_SOURCE_AUTH_CONFIGURATION_INVALID',
        503,
        'Sumber CU wajib memakai HTTPS ketika Basic Auth diaktifkan.',
      )
    }

    // Header hanya hidup di proses backend; base64 bukan enkripsi sehingga HTTPS tetap wajib.
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`
  }

  return { sourceUrl, headers }
}

/**
 * Menerima integer JSON maupun digit-string yang lazim dikirim query vendor, lalu menghasilkan
 * satu representasi number canonical. Nilai pecahan, negatif, dan overflow ditolak di boundary.
 */
function parseCount(value, fieldName) {
  const normalized = typeof value === 'string' && /^\d+$/.test(value.trim())
    ? Number(value.trim())
    : value

  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw invalidPayload(`${fieldName} harus berupa bilangan bulat non-negatif.`)
  }

  return normalized
}

/**
 * Mengubah schema positional vendor menjadi kontrak bernama yang stabil untuk frontend.
 * Urutan tuple adalah invariant integrasi: [Remediated, Applicable, Fixlet Name]. Semua row
 * diakumulasi sesuai kontrak sumber; `total` dan `progressPercent` hanya dihitung di sini agar
 * setiap consumer menggunakan definisi bisnis yang sama.
 *
 * @param {unknown} payload Respons JSON mentah dari sumber CU.
 * @returns {{
 *   counts: { patched: number, unpatched: number },
 *   total: number,
 *   progressPercent: number|null,
 *   sourceRowCount: number
 * }} Ringkasan canonical tanpa metadata atau credential vendor.
 * @throws {CuDashboardSourceError} Jika bentuk atau nilai payload melanggar kontrak.
 */
export function normalizeCuDashboardPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalidPayload('Root respons CU harus berupa object JSON.')
  }

  if (!Array.isArray(payload.result) || payload.result.length === 0) {
    throw invalidPayload('Respons CU harus memiliki minimal satu row result.')
  }

  let patched = 0
  let unpatched = 0

  payload.result.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== 3) {
      throw invalidPayload(`Row CU indeks ${index} harus mengikuti format [remediated, applicable, fixletName].`)
    }

    const rowPatched = parseCount(row[0], `Remediated Computer Count row ${index}`)
    const rowUnpatched = parseCount(row[1], `Applicable Computer Count row ${index}`)
    // Nama belum ditampilkan, tetapi tetap divalidasi agar perubahan schema vendor gagal eksplisit.
    const fixletName = typeof row[2] === 'string' ? row[2].trim() : ''

    if (!fixletName || fixletName.length > MAX_FIXLET_NAME_LENGTH) {
      throw invalidPayload(`Fixlet Name row ${index} wajib berupa string yang tidak kosong.`)
    }

    patched += rowPatched
    unpatched += rowUnpatched
    if (!Number.isSafeInteger(patched) || !Number.isSafeInteger(unpatched)) {
      throw invalidPayload('Akumulasi jumlah perangkat melebihi batas integer aman.')
    }
  })

  const total = patched + unpatched
  if (!Number.isSafeInteger(total)) {
    throw invalidPayload('Total perangkat melebihi batas integer aman.')
  }

  return {
    counts: { patched, unpatched },
    total,
    progressPercent: total === 0 ? null : Number(((patched / total) * 100).toFixed(2)),
    sourceRowCount: payload.result.length,
  }
}

/**
 * Mengambil ringkasan CU dari sumber server-side dan melewatkannya melalui normalizer tunggal.
 * Timeout, redirect, status HTTP, media type, dan JSON diperlakukan sebagai boundary kegagalan
 * upstream; caller hanya perlu memetakan `CuDashboardSourceError` ke respons API yang aman.
 *
 * @returns {Promise<ReturnType<typeof normalizeCuDashboardPayload> & { retrievedAt: string }>}
 * @throws {CuDashboardSourceError} Jika konfigurasi, jaringan, atau respons sumber tidak valid.
 */
export async function loadCuDashboard() {
  const { sourceUrl, headers } = readSourceConfiguration()
  let response

  try {
    response = await fetch(sourceUrl, {
      method: 'GET',
      headers,
      // Jangan meneruskan Authorization ke lokasi redirect yang tidak menjadi bagian konfigurasi.
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    throw new CuDashboardSourceError(
      isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      isTimeout ? 504 : 502,
      isTimeout ? 'Request sumber CU melewati batas waktu.' : 'Sumber CU tidak dapat dihubungi.',
      { cause: error },
    )
  }

  if (!response.ok) {
    throw new CuDashboardSourceError(
      'UPSTREAM_UNAVAILABLE',
      502,
      `Sumber CU merespons HTTP ${response.status}.`,
    )
  }

  // Media type diperiksa sebelum parsing supaya HTML error page tidak dianggap JSON domain.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) {
    throw invalidPayload('Sumber CU harus mengirim Content-Type JSON.')
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    throw new CuDashboardSourceError(
      'UPSTREAM_INVALID_RESPONSE',
      502,
      'JSON sumber CU tidak dapat dibaca.',
      { cause: error },
    )
  }

  return {
    ...normalizeCuDashboardPayload(payload),
    retrievedAt: new Date().toISOString(),
  }
}
