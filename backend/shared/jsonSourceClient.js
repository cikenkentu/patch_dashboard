const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024 * 1024

function isTimeoutError(error, signal) {
  return signal.aborted || error?.name === 'TimeoutError' || error?.name === 'AbortError'
}

function upstreamReadError(error, signal, sourceLabel) {
  const isTimeout = isTimeoutError(error, signal)
  return new JsonSourceError(
    isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_INVALID_RESPONSE',
    isTimeout ? 504 : 502,
    isTimeout
      ? `Request ${sourceLabel} melewati batas waktu.`
      : `JSON ${sourceLabel} tidak dapat dibaca.`,
    { cause: error },
  )
}

/** Melepas koneksi upstream pada jalur reject tanpa menjadikan kegagalan cancel sebagai error publik. */
async function cancelResponseBody(response) {
  try {
    await response.body?.cancel()
  } catch {
    // Socket/stream mungkin sudah ditutup oleh upstream; tidak ada detail internal yang perlu diekspos.
  }
}

/**
 * Error transport terklasifikasi yang aman dipetakan route menjadi status/code publik.
 * Detail URL, Authorization, response body, dan cause tetap internal dan tidak pernah diserialisasi.
 */
export class JsonSourceError extends Error {
  constructor(code, statusCode, message, options) {
    super(message, options)
    this.name = 'JsonSourceError'
    this.code = code
    this.statusCode = statusCode
  }
}

/** Dipakai adapter domain ketika JSON valid secara sintaks tetapi melanggar schema vendor. */
export function invalidSourcePayload(message) {
  return new JsonSourceError('UPSTREAM_INVALID_RESPONSE', 502, message)
}

/**
 * Membaca konfigurasi yang nama environment-nya ditetapkan adapter, bukan request browser.
 * Batas ini mencegah endpoint/credential menjadi input pengguna dan mengurangi risiko SSRF.
 */
function readSourceConfiguration({ urlEnv, usernameEnv, passwordEnv }) {
  const configuredUrl = process.env[urlEnv]?.trim()
  if (!configuredUrl) {
    throw new JsonSourceError('SOURCE_NOT_CONFIGURED', 503, `${urlEnv} belum dikonfigurasi.`)
  }

  let sourceUrl
  try {
    sourceUrl = new URL(configuredUrl)
  } catch (error) {
    throw new JsonSourceError(
      'SOURCE_CONFIGURATION_INVALID',
      503,
      `${urlEnv} bukan URL yang valid.`,
      { cause: error },
    )
  }

  if (!['http:', 'https:'].includes(sourceUrl.protocol) || sourceUrl.username || sourceUrl.password) {
    throw new JsonSourceError(
      'SOURCE_CONFIGURATION_INVALID',
      503,
      `${urlEnv} harus berupa URL HTTP(S) tanpa credential tertanam.`,
    )
  }

  const username = process.env[usernameEnv]?.trim() ?? ''
  const password = process.env[passwordEnv] ?? ''
  const hasUsername = username.length > 0
  const hasPassword = password.length > 0

  // Autentikasi harus lengkap atau sepenuhnya anonim; tidak ada fallback request anonim diam-diam.
  if (hasUsername !== hasPassword) {
    throw new JsonSourceError(
      'SOURCE_AUTH_CONFIGURATION_INVALID',
      503,
      `${usernameEnv} dan ${passwordEnv} harus dikonfigurasi berpasangan.`,
    )
  }

  const headers = { Accept: 'application/json' }
  if (hasUsername) {
    if (username.includes(':')) {
      throw new JsonSourceError(
        'SOURCE_AUTH_CONFIGURATION_INVALID',
        503,
        `${usernameEnv} tidak boleh mengandung karakter titik dua.`,
      )
    }
    if (sourceUrl.protocol !== 'https:') {
      throw new JsonSourceError(
        'SOURCE_AUTH_CONFIGURATION_INVALID',
        503,
        'Sumber wajib memakai HTTPS ketika Basic Auth diaktifkan.',
      )
    }

    // Base64 bukan enkripsi; header hanya aman karena request berautentikasi diwajibkan HTTPS.
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`
  }

  return { sourceUrl, headers }
}

/**
 * Membaca body sebagai byte stream dengan hard limit sebelum parsing. Pemeriksaan row pada adapter
 * domain tetap diperlukan, tetapi limit transport mencegah respons besar menghabiskan memory lebih
 * dahulu. Byte yang dihitung adalah payload setelah decompression, sehingga header yang keliru tidak
 * dapat melewati batas ini.
 */
async function readJsonBody(response, { signal, sourceLabel, maxResponseBytes }) {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    await cancelResponseBody(response)
    throw invalidSourcePayload(`${sourceLabel} melebihi batas ukuran respons.`)
  }
  if (!response.body) {
    throw invalidSourcePayload(`${sourceLabel} tidak memiliki body JSON.`)
  }

  const reader = response.body.getReader()
  const chunks = []
  let receivedBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      receivedBytes += value.byteLength
      if (receivedBytes > maxResponseBytes) {
        await reader.cancel('Response size limit exceeded')
        throw invalidSourcePayload(`${sourceLabel} melebihi batas ukuran respons.`)
      }
      chunks.push(Buffer.from(value))
    }
  } catch (error) {
    if (error instanceof JsonSourceError) throw error
    throw upstreamReadError(error, signal, sourceLabel)
  } finally {
    reader.releaseLock()
  }

  try {
    const bytes = Buffer.concat(chunks, receivedBytes)
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return JSON.parse(text)
  } catch (error) {
    throw upstreamReadError(error, signal, sourceLabel)
  }
}

/**
 * Transport JSON reusable. Fungsi ini tidak mengetahui tuple CU maupun kontrak report.
 * Adapter domain menerima JSON mentah dan tetap bertanggung jawab atas validasi schema/mapping.
 */
export async function fetchJsonSource({
  urlEnv,
  usernameEnv,
  passwordEnv,
  sourceLabel,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('timeoutMs harus berupa integer positif.')
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
    throw new TypeError('maxResponseBytes harus berupa integer positif.')
  }

  const { sourceUrl, headers } = readSourceConfiguration({ urlEnv, usernameEnv, passwordEnv })
  const signal = AbortSignal.timeout(timeoutMs)
  let response

  try {
    response = await fetch(sourceUrl, {
      method: 'GET',
      headers,
      // Authorization tidak boleh diteruskan otomatis ke URL hasil redirect.
      redirect: 'error',
      signal,
    })
  } catch (error) {
    const isTimeout = isTimeoutError(error, signal)
    throw new JsonSourceError(
      isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      isTimeout ? 504 : 502,
      isTimeout ? `Request ${sourceLabel} melewati batas waktu.` : `${sourceLabel} tidak dapat dihubungi.`,
      { cause: error },
    )
  }

  if (!response.ok) {
    await cancelResponseBody(response)
    throw new JsonSourceError(
      'UPSTREAM_UNAVAILABLE',
      502,
      `${sourceLabel} merespons HTTP ${response.status}.`,
    )
  }

  // Tolak halaman error HTML dari proxy sebelum mencoba membaca schema domain.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) {
    await cancelResponseBody(response)
    throw invalidSourcePayload(`${sourceLabel} harus mengirim Content-Type JSON.`)
  }

  return readJsonBody(response, { signal, sourceLabel, maxResponseBytes })
}
