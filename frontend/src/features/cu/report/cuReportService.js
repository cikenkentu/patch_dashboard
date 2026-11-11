// URL same-origin adalah kontrak frontend; hanya backend yang mengetahui endpoint dan auth sumber.
const CU_REPORT_API_URL = '/api/report/cu'

// Menambah kolom domain wajib dilakukan di kontrak ini dan provider backend sebelum dipakai view.
const DEVICE_FIELDS = Object.freeze([
  'id',
  'hostname',
  'ipAddress',
  'osVersion',
  'processor',
  'patchStatus',
  'lastPatch',
  'lastReportTime',
])

// Nilai canonical ini adalah kontrak domain; label dan warna terjemahan tetap dimiliki view.
const DEVICE_PATCH_STATUSES = Object.freeze(['patched', 'unpatched'])
const REQUIRED_DEVICE_STRING_FIELDS = Object.freeze(
  DEVICE_FIELDS.filter((field) => field !== 'patchStatus' && field !== 'lastPatch'),
)

/**
 * Menormalisasi satu record canonical setelah seluruh field wajib lolos validasi.
 * Validasi ketat dan all-or-nothing mencegah baris parsial merusak filter, export, atau data-key tabel.
 */
function validateCuReportDevice(record, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`Perangkat pada indeks ${index} harus berupa object.`)
  }

  const missingField = DEVICE_FIELDS.find((field) => !Object.hasOwn(record, field))
  if (missingField) {
    throw new TypeError(`Perangkat pada indeks ${index} tidak memiliki field ${missingField}.`)
  }

  // Dua field patch belum tersedia di sumber ini; field identitas/inventory tetap wajib lengkap.
  for (const field of REQUIRED_DEVICE_STRING_FIELDS) {
    if (typeof record[field] !== 'string' || !record[field].trim()) {
      throw new TypeError(`Field ${field} pada perangkat indeks ${index} wajib berupa string.`)
    }
  }

  if (
    record.patchStatus !== null
    && (typeof record.patchStatus !== 'string' || !record.patchStatus.trim())
  ) {
    throw new TypeError(`Field patchStatus pada perangkat indeks ${index} harus string atau null.`)
  }

  if (
    record.lastPatch !== null
    && (typeof record.lastPatch !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.lastPatch.trim()))
  ) {
    throw new TypeError(`Field lastPatch pada perangkat indeks ${index} harus YYYY-MM atau null.`)
  }

  const device = {
    id: record.id.trim(),
    hostname: record.hostname.trim(),
    ipAddress: record.ipAddress.trim(),
    osVersion: record.osVersion.trim(),
    processor: record.processor.trim(),
    patchStatus: record.patchStatus?.trim() ?? null,
    lastPatch: record.lastPatch?.trim() ?? null,
    lastReportTime: record.lastReportTime.trim(),
  }

  if (device.patchStatus !== null && !DEVICE_PATCH_STATUSES.includes(device.patchStatus)) {
    throw new TypeError(`Patch status tidak dikenal: ${device.patchStatus}.`)
  }
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(device.lastReportTime)
  if (!hasTimezone || !Number.isFinite(Date.parse(device.lastReportTime))) {
    throw new TypeError('Last Report Time harus berupa timestamp ISO 8601 dengan zona waktu.')
  }

  return device
}

function validateCuReportDevices(payload) {
  if (!Array.isArray(payload)) {
    throw new TypeError('Root respons perangkat harus berupa array JSON.')
  }

  // Satu record invalid menggagalkan response penuh agar UI tidak menampilkan dataset setengah benar.
  const devices = payload.map(validateCuReportDevice)

  // ID duplikat merusak data-key tabel dan biasanya menandakan mapping backend bermasalah.
  if (new Set(devices.map((device) => device.id)).size !== devices.length) {
    throw new TypeError('Setiap perangkat harus memiliki ID yang unik.')
  }

  return devices
}

/**
 * Kontrak satu perangkat yang harus dikirim backend.
 * Bulan patch memakai YYYY-MM; waktu melapor memakai ISO 8601 agar zona waktu sumber tidak hilang.
 * Kontrak ini sengaja bebas dari label UI sehingga dapat dipakai filter, CSV, dan tabel lain.
 *
 * @typedef {Object} CuReportDevice
 * @property {string} id ID unik dan stabil untuk data-key tabel.
 * @property {string} hostname Nama perangkat.
 * @property {string} ipAddress Alamat IP perangkat.
 * @property {string} osVersion Nama dan versi OS.
 * @property {string} processor Informasi processor dari sumber inventory; belum ditampilkan sebagai kolom.
 * @property {'patched'|'unpatched'|null} patchStatus Status patch, atau null sampai sumber tersedia.
 * @property {string|null} lastPatch Bulan patch terakhir dalam format YYYY-MM, atau null bila belum diketahui.
 * @property {string} lastReportTime Timestamp ISO 8601 dengan Z/offset saat terakhir melapor.
 */

/**
 * Mengambil dataset perangkat melalui satu pintu supaya view tidak mengetahui detail backend.
 * JSON `[]` adalah respons valid ketika sumber belum memiliki data.
 *
 * @returns {Promise<CuReportDevice[]>}
 * @throws {Error|TypeError} Jika jaringan, HTTP, JSON, atau bentuk respons tidak valid.
 */
export async function fetchCuReportDevices() {
  // Browser hanya memanggil backend internal; autentikasi, retry, audit, dan BigFix berada di backend.
  // Jangan menambahkan credential atau token berumur panjang ke header request frontend.
  let response
  try {
    response = await fetch(CU_REPORT_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    throw new Error('Tidak dapat terhubung ke API perangkat.', { cause: error })
  }

  // Fetch tidak melempar error untuk HTTP 4xx/5xx, sehingga status harus diperiksa eksplisit.
  if (!response.ok) {
    throw new Error(`Gagal mengambil data perangkat (${response.status}).`)
  }

  // Media type menjaga reverse-proxy error page tidak lolos ke validator record.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new TypeError('API perangkat harus mengirim Content-Type application/json.')
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    throw new Error('Respons JSON API perangkat tidak dapat dibaca.', { cause: error })
  }

  try {
    // JSON hanya melewati boundary ini setelah setiap record memenuhi kontrak canonical.
    return validateCuReportDevices(payload)
  } catch (error) {
    throw new Error('Respons API perangkat bukan JSON Device yang valid.', { cause: error })
  }
}
