import { fetchJsonSource, invalidSourcePayload } from './jsonSourceClient.js'

const SOURCE_URL_ENV = 'PATCHING_CU_SOURCE_URL'
const SOURCE_USERNAME_ENV = 'PATCHING_CU_SOURCE_USERNAME'
const SOURCE_PASSWORD_ENV = 'PATCHING_CU_SOURCE_PASSWORD'
const MAX_FIXLET_NAME_LENGTH = 512

// Semua kegagalan schema vendor memakai satu kode supaya route tidak perlu memahami detail tuple.
function invalidPayload(message) {
  return invalidSourcePayload(message)
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
 * @throws {import('./jsonSourceClient.js').JsonSourceError} Jika bentuk atau nilai payload melanggar kontrak.
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
 * Timeout, redirect, status HTTP, media type, dan parsing JSON dimiliki transport bersama;
 * adapter ini hanya memegang aturan tuple dan agregasi khusus dashboard CU.
 *
 * @returns {Promise<ReturnType<typeof normalizeCuDashboardPayload> & { retrievedAt: string }>}
 * @throws {import('./jsonSourceClient.js').JsonSourceError} Jika konfigurasi, jaringan, atau respons sumber tidak valid.
 */
export async function loadCuDashboard() {
  const payload = await fetchJsonSource({
    urlEnv: SOURCE_URL_ENV,
    usernameEnv: SOURCE_USERNAME_ENV,
    passwordEnv: SOURCE_PASSWORD_ENV,
    sourceLabel: 'Sumber ringkasan CU',
  })

  return {
    ...normalizeCuDashboardPayload(payload),
    retrievedAt: new Date().toISOString(),
  }
}
