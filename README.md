# Patching Dashboard

Frontend Vue untuk menampilkan ringkasan dan report status patch perangkat. Saat development, dataset contoh otomatis dipakai untuk memperlihatkan bentuk chart sebelum backend atau BigFix terhubung.

## Menjalankan project

Prasyarat: Node.js 20.19+ dan npm.

```bash
npm install
npm run dev
```

Tanpa `VITE_DEVICE_API_URL`, mode development membuat 5.000 perangkat berawalan `DEMO-` dengan komposisi 3.500 sudah di-patch dan 1.500 belum di-patch. Data dibuat melalui generator ringkas di service, bukan ribuan object manual. Endpoint yang dikonfigurasi selalu menggantikan data contoh tersebut.

Build produksi:

```bash
npm run build
npm run preview
```

## Teknologi

- Vue 3 + Vite (JavaScript)
- Vue Router
- PrimeVue DataTable dan komponen filter
- Chart.js langsung tanpa wrapper Vue

## Lisensi dan deployment perusahaan

Dependency yang terkunci di `package-lock.json` telah diaudit: semuanya memakai lisensi open-source permisif MIT, BSD-2-Clause, BSD-3-Clause, atau ISC. Tidak ada dependency GPL/AGPL, source-available, atau proprietary. Project juga tidak memakai template/PrimeBlocks premium, font eksternal, CDN, maupun aset gambar pihak ketiga.

Gunakan `npm ci` pada CI/CD agar versi yang dipasang sama persis dengan lockfile. `npm run build` otomatis membuat `dist/THIRD_PARTY_LICENSES.txt` berisi notice lisensi dependency yang benar-benar masuk bundle. Sertakan file tersebut bersama seluruh isi `dist` saat deployment; jangan dihapus dari artifact.

Audit lisensi perlu diulang setiap kali `package-lock.json` berubah atau dependency/aset baru ditambahkan. Produk premium PrimeTek tidak otomatis tercakup oleh lisensi MIT PrimeVue dan tidak digunakan di project ini.

Project ini sengaja tetap memakai PrimeVue 4 yang berlisensi MIT. PrimeVue 5 dan generasi PrimeUI berikutnya memakai lisensi komersial, sehingga upgrade major tersebut harus melalui review lisensi/procurement terlebih dahulu.

## Struktur utama

```text
src/
|-- services/deviceService.js   # Satu titik pengambilan data/API
|-- views/dashboard/
|   |-- dashboard_view.vue      # Controller: fetch, ringkasan, routing, dan grid
|   |-- dashboard_cu.vue        # Widget CU: identitas doughnut chart
|   |-- status_chart_card.vue   # Tampilan/interaksi chart yang dipakai bersama
|   `-- dashboard_dummy1..5.vue # Identitas judul dan tipe masing-masing chart
|-- views/report/report_cu.vue  # Filter, tabel, export CSV, dan formatter waktu
|-- App.vue                     # Shell, header, dan style global
`-- main.js                     # Inisialisasi Vue, PrimeVue, dan route
```

Implementasi memakai composition Vue: `dashboard_view.vue` mengorkestrasi data dan navigasi, sedangkan setiap widget hanya mendeklarasikan identitas chart lalu memakai `status_chart_card.vue`. Nama `dashboard_dummy` menandai variasi chart prototype; data contoh development berada di service agar Dashboard dan Report tetap konsisten.

## Ubah apa di mana

- Ubah sumber data atau integrasi API di `src/services/deviceService.js`.
- Ubah fetch, ringkasan bersama, susunan grid, atau routing dashboard di `src/views/dashboard/dashboard_view.vue`.
- Ubah judul/tipe widget CU di `src/views/dashboard/dashboard_cu.vue`.
- Ubah style/interaksi semua kartu chart di `src/views/dashboard/status_chart_card.vue`; judul dan tipe dummy berada di `dashboard_dummy1.vue` sampai `dashboard_dummy5.vue`.
- Ubah filter, kolom tabel, pagination, export CSV, atau format waktu di `src/views/report/report_cu.vue`.
- Ubah header, navigasi, atau style global di `src/App.vue`.
- Ubah route atau konfigurasi PrimeVue di `src/main.js`.

## Integrasi data

Semua pengambilan data berada di `src/services/deviceService.js`. View Dashboard dan Report tidak perlu mengetahui alamat BigFix atau detail implementasi backend.

Alur yang disarankan:

```text
Vue frontend -> GET /api/devices -> Backend internal -> BigFix
```

Backend menyediakan endpoint read-only yang sudah menormalisasi data BigFix. Kemudian buat `.env.local` di root project:

```env
VITE_DEVICE_API_URL=/api/devices
```

`VITE_DEVICE_API_URL` adalah URL endpoint perangkat yang lengkap. Path relatif seperti `/api/devices` disarankan agar memakai origin yang sama. Jika backend berada di domain berbeda, isi dengan URL absolut dan konfigurasikan CORS di backend.

Restart `npm run dev` setelah mengubah `.env.local`. Untuk produksi, isi environment tersebut sebelum menjalankan `npm run build` karena Vite menanam nilainya ke hasil build. Jika variabel belum diisi, `npm run dev` memakai data contoh, sedangkan build production mengembalikan array kosong. Data contoh development tidak menggantikan endpoint yang sudah dikonfigurasi.

Semua variabel `VITE_*` dapat terlihat di browser. Jangan menyimpan username, password, token, atau credential BigFix di frontend maupun `.env.local`; seluruh credential harus berada di backend.

Endpoint harus merespons HTTP 200 dengan JSON array berikut, bukan object wrapper:

```json
[
  {
    "id": "device-001",
    "hostname": "BKK-SRV-001",
    "ipAddress": "10.20.1.15",
    "osVersion": "Windows Server 2022 Datacenter",
    "patchStatus": "patched",
    "lastReportTime": "2026-10-28T08:42:00+07:00"
  }
]
```

`patchStatus` hanya menerima `patched` atau `unpatched`. `lastReportTime` menggunakan timestamp ISO 8601 dengan informasi zona waktu.

## Route

- `/` - dashboard kartu chart
- `/reports` - seluruh perangkat
- `/reports?status=patched` - perangkat yang sudah di-patch
- `/reports?status=unpatched` - perangkat yang belum di-patch

Tombol **Export CSV** mengunduh seluruh hasil pencarian dan filter yang aktif, bukan hanya 20 baris pada halaman pagination saat ini.

`Last Report Time` adalah waktu terakhir perangkat melapor dan ditampilkan dalam zona waktu ICT (UTC+7), bukan waktu patch dipasang.
