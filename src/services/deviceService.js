// Batas integrasi frontend: ganti implementasi di file ini saat backend BigFix sudah tersedia.
// URL endpoint lengkap diisi lewat .env.local, contoh: VITE_DEVICE_API_URL=/api/devices.
// Variabel VITE_* masuk ke bundle browser; jangan pernah isi credential atau token BigFix di sini.
const DEVICE_API_URL = import.meta.env.VITE_DEVICE_API_URL?.trim()

// Metadata presentasi bersama menjaga label dan warna konsisten di dashboard, filter, serta tabel.
// Backend cukup mengirim patchStatus "patched" atau "unpatched"; label/warna tetap milik frontend.
export const PATCH_STATUS = Object.freeze({
  patched: {
    value: 'patched',
    label: 'Sudah di-patch',
    color: '#1f9d68',
  },
  unpatched: {
    value: 'unpatched',
    label: 'Belum di-patch',
    color: '#f59e0b',
  },
})

/**
 * Kontrak satu perangkat yang harus dikirim backend.
 * Timestamp memakai ISO 8601 agar zona waktu sumber tidak hilang saat diformat di browser.
 *
 * @typedef {Object} Device
 * @property {string} id ID unik dan stabil untuk data-key tabel.
 * @property {string} hostname Nama perangkat.
 * @property {string} ipAddress Alamat IP perangkat.
 * @property {string} osVersion Nama dan versi OS.
 * @property {'patched'|'unpatched'} patchStatus Status patch yang sudah dinormalisasi backend.
 * @property {string} lastReportTime Timestamp ISO 8601 dengan Z/offset saat terakhir melapor.
 */

// Generator menjaga mock ribuan perangkat tetap ringkas dan mudah diubah dari satu tempat.
const SAMPLE_DEVICE_TOTAL = 5_000
const SAMPLE_PATCHED_PER_TEN = 7
const SAMPLE_REPORT_BASE_TIME = Date.parse('2026-10-29T05:00:00Z')
const SAMPLE_OPERATING_SYSTEMS = [
  'Windows 11 Enterprise 23H2',
  'Windows 11 Enterprise 24H2',
  'Windows 10 Enterprise 22H2',
  'Windows Server 2022 Datacenter',
  'Windows Server 2019 Standard',
]

/**
 * Membuat 5.000 perangkat development: 3.500 patched dan 1.500 unpatched.
 * Hostname memakai awalan DEMO agar tidak tertukar dengan perangkat produksi.
 * Setiap pemanggilan menghasilkan array baru tanpa menulis ribuan object secara manual.
 *
 * @returns {Device[]}
 */
function getDevelopmentSampleDevices() {
  return Array.from({ length: SAMPLE_DEVICE_TOTAL }, (_, index) => {
    const sequence = index + 1
    const sequenceLabel = String(sequence).padStart(5, '0')

    // Satu subnet menampung 254 host; pembagian ini membuat seluruh IP privat tetap unik.
    const thirdOctet = Math.floor(index / 254) + 1
    const fourthOctet = (index % 254) + 1

    return {
      id: `demo-${sequenceLabel}`,
      hostname: `DEMO-DEVICE-${sequenceLabel}`,
      ipAddress: `10.20.${thirdOctet}.${fourthOctet}`,
      osVersion: SAMPLE_OPERATING_SYSTEMS[index % SAMPLE_OPERATING_SYSTEMS.length],
      // Pola 7:3 menghasilkan komposisi tepat 70% patched untuk setiap sepuluh perangkat.
      patchStatus: index % 10 < SAMPLE_PATCHED_PER_TEN ? 'patched' : 'unpatched',
      // Waktu digeser per menit agar sorting report mudah diuji dengan data bervariasi.
      lastReportTime: new Date(SAMPLE_REPORT_BASE_TIME - (index % 4_320) * 60_000).toISOString(),
    }
  })
}

/**
 * Mengambil dataset perangkat melalui satu pintu supaya view tidak mengetahui detail backend.
 * Tanpa endpoint, mode development memakai sample; build production tetap mengembalikan array kosong.
 *
 * @returns {Promise<Device[]>}
 * @throws {Error|TypeError} Jika jaringan, HTTP, JSON, atau bentuk respons tidak valid.
 */
export async function fetchDevices() {
  if (!DEVICE_API_URL) {
    // Vite mengganti DEV secara statis; branch sample dibuang dari bundle production.
    return import.meta.env.DEV ? getDevelopmentSampleDevices() : []
  }

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

  let devices
  try {
    devices = await response.json()
  } catch (error) {
    throw new Error('Respons API perangkat bukan JSON yang valid.', { cause: error })
  }

  // Validasi boundary minimal: cegah view menerima object/error payload seolah-olah daftar perangkat.
  // Validasi schema per-field dapat ditambahkan di sini ketika kontrak backend sudah final.
  if (!Array.isArray(devices)) {
    throw new TypeError('Respons API perangkat harus berupa array.')
  }

  // Dataset tetap mentah; seluruh ringkasan dan filter diturunkan di view dari sumber yang sama.
  return devices
}
