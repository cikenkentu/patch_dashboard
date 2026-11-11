// URL same-origin adalah kontrak frontend; hanya backend yang mengetahui alamat dan auth sumber CU.
const CU_DASHBOARD_API_URL = '/api/dashboard/cu'

// Object plain wajib agar instance/class atau array tidak lolos sebagai kontrak JSON canonical.
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateCount(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} harus berupa bilangan bulat non-negatif.`)
  }
  return value
}

/**
 * Memvalidasi kontrak canonical dari backend sebelum data mencapai state Vue.
 * Pengecekan field turunan (`total` dan `progressPercent`) mendeteksi perubahan kontrak atau proxy
 * yang mengirim payload tidak konsisten; tuple positional vendor tidak pernah masuk komponen.
 *
 * @param {unknown} payload JSON dari `/api/dashboard/cu`.
 * @returns {{
 *   counts: { patched: number, unpatched: number },
 *   total: number,
 *   progressPercent: number|null,
 *   sourceRowCount: number,
 *   retrievedAt: string
 * }} Ringkasan immutable-by-convention untuk layer view.
 */
function validateCuDashboardSummary(payload) {
  if (!isPlainObject(payload) || !isPlainObject(payload.counts)) {
    throw new TypeError('Ringkasan CU harus berupa object canonical.')
  }

  const patched = validateCount(payload.counts.patched, 'counts.patched')
  const unpatched = validateCount(payload.counts.unpatched, 'counts.unpatched')
  const total = validateCount(payload.total, 'total')

  if (total !== patched + unpatched) {
    throw new TypeError('Total CU tidak sama dengan patched + unpatched.')
  }

  const expectedProgress = total === 0 ? null : Number(((patched / total) * 100).toFixed(2))
  if (payload.progressPercent !== expectedProgress) {
    throw new TypeError('Progress CU tidak konsisten dengan jumlah perangkat.')
  }

  if (!Number.isSafeInteger(payload.sourceRowCount) || payload.sourceRowCount < 1) {
    throw new TypeError('sourceRowCount CU harus berupa bilangan bulat positif.')
  }

  if (
    typeof payload.retrievedAt !== 'string'
    || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(payload.retrievedAt)
    || !Number.isFinite(Date.parse(payload.retrievedAt))
  ) {
    throw new TypeError('retrievedAt CU harus berupa timestamp ISO 8601 dengan zona waktu.')
  }

  return {
    counts: { patched, unpatched },
    total,
    progressPercent: payload.progressPercent,
    sourceRowCount: payload.sourceRowCount,
    retrievedAt: payload.retrievedAt,
  }
}

/**
 * Satu-satunya gateway frontend untuk ringkasan CU.
 * Fungsi ini memiliki boundary jaringan, HTTP, media type, parsing, dan schema; view hanya menangani
 * success/error UI dan tidak boleh mengetahui credential maupun bentuk respons vendor.
 *
 * @returns {Promise<ReturnType<typeof validateCuDashboardSummary>>}
 * @throws {Error} Jika transport, HTTP, JSON, atau kontrak canonical gagal.
 */
export async function fetchCuDashboardSummary() {
  let response
  try {
    response = await fetch(CU_DASHBOARD_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    throw new Error('Tidak dapat terhubung ke API ringkasan CU.', { cause: error })
  }

  // Fetch hanya reject pada kegagalan transport; status 4xx/5xx diperiksa secara eksplisit.
  if (!response.ok) {
    throw new Error(`Gagal mengambil ringkasan CU (${response.status}).`)
  }

  // Tolak error page HTML dari reverse proxy sebelum mencoba parse sebagai payload domain.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new TypeError('API ringkasan CU harus mengirim Content-Type application/json.')
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    throw new Error('Respons JSON ringkasan CU tidak dapat dibaca.', { cause: error })
  }

  try {
    return validateCuDashboardSummary(payload)
  } catch (error) {
    throw new Error('Respons API ringkasan CU tidak valid.', { cause: error })
  }
}
