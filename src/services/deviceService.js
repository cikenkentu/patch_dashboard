// Frontend selalu berbicara ke backend internal; default same-origin bekerja saat dev dan deployment.
// VITE_DEVICE_API_URL hanya diperlukan bila API sengaja ditempatkan pada URL berbeda.
// Variabel VITE_* masuk ke bundle browser; jangan pernah isi credential atau token BigFix di sini.
const DEVICE_API_URL = import.meta.env.VITE_DEVICE_API_URL?.trim() || '/api/devices'

const DEVICE_FIELDS = Object.freeze([
  'id',
  'hostname',
  'ipAddress',
  'osVersion',
  'patchStatus',
  'lastPatch',
  'lastReportTime',
])

// Nilai canonical ini adalah bagian kontrak JSON, bukan metadata tampilan.
const DEVICE_PATCH_STATUSES = Object.freeze(['patched', 'unpatched'])

// Validasi boundary diletakkan di service agar komponen Vue selalu menerima bentuk data yang sama.
function validateDevice(record, index) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`Perangkat pada indeks ${index} harus berupa object.`)
  }

  const missingField = DEVICE_FIELDS.find((field) => !Object.hasOwn(record, field))
  if (missingField) {
    throw new TypeError(`Perangkat pada indeks ${index} tidak memiliki field ${missingField}.`)
  }

  const requiredStrings = DEVICE_FIELDS.filter((field) => field !== 'lastPatch')
  for (const field of requiredStrings) {
    if (typeof record[field] !== 'string' || !record[field].trim()) {
      throw new TypeError(`Field ${field} pada perangkat indeks ${index} wajib berupa string.`)
    }
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
    patchStatus: record.patchStatus.trim(),
    lastPatch: record.lastPatch?.trim() ?? null,
    lastReportTime: record.lastReportTime.trim(),
  }

  if (!DEVICE_PATCH_STATUSES.includes(device.patchStatus)) {
    throw new TypeError(`Patch status tidak dikenal: ${device.patchStatus}.`)
  }
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(device.lastReportTime)
  if (!hasTimezone || !Number.isFinite(Date.parse(device.lastReportTime))) {
    throw new TypeError('Last Report Time harus berupa timestamp ISO 8601 dengan zona waktu.')
  }

  return device
}

function validateDevices(payload) {
  if (!Array.isArray(payload)) {
    throw new TypeError('Root respons perangkat harus berupa array JSON.')
  }

  const devices = payload.map(validateDevice)

  // ID duplikat merusak data-key tabel dan biasanya menandakan mapping backend bermasalah.
  if (new Set(devices.map((device) => device.id)).size !== devices.length) {
    throw new TypeError('Setiap perangkat harus memiliki ID yang unik.')
  }

  return devices
}

/**
 * Kontrak satu perangkat yang harus dikirim backend.
 * Bulan patch memakai YYYY-MM; waktu melapor memakai ISO 8601 agar zona waktu sumber tidak hilang.
 *
 * @typedef {Object} Device
 * @property {string} id ID unik dan stabil untuk data-key tabel.
 * @property {string} hostname Nama perangkat.
 * @property {string} ipAddress Alamat IP perangkat.
 * @property {string} osVersion Nama dan versi OS.
 * @property {'patched'|'unpatched'} patchStatus Status patch yang sudah dinormalisasi backend.
 * @property {string|null} lastPatch Bulan patch terakhir dalam format YYYY-MM, atau null bila belum diketahui.
 * @property {string} lastReportTime Timestamp ISO 8601 dengan Z/offset saat terakhir melapor.
 */

/**
 * Mengambil dataset perangkat melalui satu pintu supaya view tidak mengetahui detail backend.
 * JSON `[]` adalah respons valid ketika sumber belum memiliki data.
 *
 * @returns {Promise<Device[]>}
 * @throws {Error|TypeError} Jika jaringan, HTTP, JSON, atau bentuk respons tidak valid.
 */
export async function fetchDevices() {
  // Browser hanya memanggil backend internal; autentikasi, retry, audit, dan BigFix berada di backend.
  // Jangan menambahkan credential atau token berumur panjang ke header request frontend.
  let response
  try {
    response = await fetch(DEVICE_API_URL, {
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
    return validateDevices(payload)
  } catch (error) {
    throw new Error('Respons API perangkat bukan JSON Device yang valid.', { cause: error })
  }
}
