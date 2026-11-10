# Patching Dashboard

Dashboard internal untuk menampilkan ringkasan dan report status patch perangkat. Frontend Vue dan backend Node disimpan dalam satu repository; data CU tetap menampilkan empty state sampai sumber nyata terhubung. Lima card lain hanya menampilkan doughnut kosong tanpa status atau angka palsu.

## Menjalankan project

Prasyarat: Node.js 20.19+ dan npm.

```bash
npm install
npm run dev
```

`npm run dev` menjalankan frontend sekaligus route API lokal melalui handler backend yang sama. Salin `.env.example` menjadi `.env`, lalu isi `PATCHING_CU_SOURCE_URL`, `PATCHING_CU_SOURCE_USERNAME`, dan `PATCHING_CU_SOURCE_PASSWORD`. Script development, preview, dan backend mandiri memuat `.env` secara otomatis; perubahan konfigurasi berlaku setelah proses di-restart. `/api/devices` tetap mengembalikan array kosong sampai endpoint detail perangkat tersedia.

Build produksi:

```bash
npm run build
npm run preview
```

Untuk menjalankan API Node secara mandiri pada `127.0.0.1:3000`:

```bash
npm run start:backend
```

Deployment dapat mengubah binding melalui environment `PATCHING_API_HOST` dan `PATCHING_API_PORT`; default loopback disarankan bila API berada di belakang reverse proxy pada host yang sama.

## Teknologi

- Vue 3 + Vite (JavaScript)
- Vue Router
- PrimeVue DataTable dan komponen filter
- Chart.js langsung tanpa wrapper Vue
- Node.js HTTP server tanpa dependency backend tambahan

## Lisensi dan deployment perusahaan

Dependency yang terkunci di `package-lock.json` telah diaudit: semuanya memakai lisensi open-source permisif MIT, BSD-2-Clause, BSD-3-Clause, atau ISC. Backend hanya memakai modul bawaan Node.js sehingga tidak menambah dependency atau lisensi pihak ketiga. Tidak ada dependency GPL/AGPL, source-available, atau proprietary.

Gunakan `npm ci` pada CI/CD agar versi yang dipasang sama persis dengan lockfile. `npm run build` otomatis membuat `dist/THIRD_PARTY_LICENSES.txt` berisi notice lisensi dependency yang benar-benar masuk bundle. Sertakan file tersebut bersama seluruh isi `dist` saat deployment; jangan dihapus dari artifact.

Audit lisensi perlu diulang setiap kali `package-lock.json` berubah atau dependency/aset baru ditambahkan. Produk premium PrimeTek tidak otomatis tercakup oleh lisensi MIT PrimeVue dan tidak digunakan di project ini.

Project ini sengaja tetap memakai PrimeVue 4 yang berlisensi MIT. PrimeVue 5 dan generasi PrimeUI berikutnya memakai lisensi komersial, sehingga upgrade major tersebut harus melalui review lisensi/procurement terlebih dahulu.

## Struktur utama

```text
backend/
|-- server.js                   # HTTP server dan route API internal
`-- cuDashboard.js              # Fetch, validasi, dan normalisasi ringkasan CU
src/
|-- services/
|   |-- cuDashboardService.js   # Boundary kontrak ringkasan dashboard CU
|   `-- deviceService.js        # Boundary kontrak detail perangkat report
|-- views/dashboard/
|   |-- dashboard_view.vue      # Halaman dan grid enam card dashboard
|   |-- dashboard_card.vue      # Shell box/title/daftar perbandingan reusable
|   |-- dashboard_chart.vue     # Renderer canvas Chart.js reusable
|   |-- dashboard_cu.vue        # Data, konfigurasi, dan routing card CU
|   `-- dashboard_slot2..6.vue  # Placeholder doughnut kosong tanpa detail status
|-- views/report/
|   |-- report_cu.vue           # Halaman, API, query, kolom, dan format CU
|   |-- report_layout.vue       # Shell judul/back-link/state reusable
|   |-- report_table.vue        # Renderer PrimeVue DataTable reusable
|   `-- report_slot2..6.vue     # Report kosong pasangan setiap doughnut placeholder
|-- App.vue                     # Shell, header, dan style global
`-- main.js                     # Inisialisasi Vue, PrimeVue, dan route
```

Repository memakai struktur monorepo ringkas tanpa memindahkan frontend ke package terpisah. Ini cocok selama frontend dan backend dimiliki tim serta siklus rilis yang sama. Pisahkan repository hanya jika keduanya nanti memiliki tim, versioning, akses, atau deployment lifecycle yang benar-benar berbeda.

Alur dashboard CU dapat dibaca linear: `dashboard_cu.vue` -> `cuDashboardService.js` -> `/api/dashboard/cu` -> `backend/cuDashboard.js` -> sumber internal. Report detail tetap terpisah: `report_cu.vue` -> `deviceService.js` -> `/api/devices`. Service tidak menyimpan label, warna, kolom, atau keputusan UI; detail tersebut berada di file domain yang menggunakannya.

## Ubah apa di mana

- Ubah mapping tuple dan aturan validasi ringkasan CU di `backend/cuDashboard.js`.
- Ubah kontrak canonical frontend ringkasan CU di `src/services/cuDashboardService.js`.
- Ubah fetch atau validasi kontrak detail perangkat di `src/services/deviceService.js`.
- Implementasikan koneksi detail perangkat server-side di `backend/server.js` pada fungsi `loadDevices()`.
- Ubah susunan card/grid atau daftar domain aktif di `src/views/dashboard/dashboard_view.vue`.
- Ubah title, label status, warna, agregasi, atau routing khusus card CU di `src/views/dashboard/dashboard_cu.vue`.
- Ubah border, spacing, title, atau slot footer seluruh box di `src/views/dashboard/dashboard_card.vue`.
- Ubah canvas, tipe, empty state, atau lifecycle Chart.js di `src/views/dashboard/dashboard_chart.vue`.
- Ubah endpoint, query URL, label/filter status, kolom, atau formatter report CU di `src/views/report/report_cu.vue`.
- Ubah back-link, susunan heading, atau state label seluruh report di `src/views/report/report_layout.vue`.
- Ubah layout, filter, pagination, export CSV, atau style semua tabel di `src/views/report/report_table.vue`.
- Ubah header, navigasi, atau style global di `src/App.vue`.
- Ubah route atau konfigurasi PrimeVue di `src/main.js`.

## Integrasi data

Dashboard dan report memakai pipeline terpisah karena response hitungan tidak memiliki hostname, IP, OS, Last Patch, atau Last Report Time. View tidak mengetahui alamat maupun credential sumber internal.

Alur yang disarankan:

```text
Dashboard CU -> GET /api/dashboard/cu -> Backend adapter -> BigFix/query internal
Report CU    -> GET /api/devices      -> Backend detail  -> BigFix/database
```

Frontend memakai endpoint same-origin berikut secara default:

```text
GET /api/devices
GET /api/dashboard/cu
GET /api/health
```

Saat development dan `npm run preview`, Vite memasang handler dari `backend/server.js` secara langsung. Untuk deployment, jalankan API dengan `npm run start:backend`, layani folder `dist` menggunakan web server perusahaan, lalu arahkan path `/api` ke backend melalui reverse proxy. Dengan pola same-origin ini frontend tidak membutuhkan CORS.

Jika API memang harus berada pada origin berbeda, override URL sebelum build dengan `VITE_DEVICE_API_URL`. Konfigurasikan CORS di backend dan restart/rebuild setelah variabel berubah. Default `/api/devices` tetap lebih sederhana dan aman.

Semua variabel `VITE_*` dapat terlihat di browser. URL dan Basic Auth query CU memakai environment server `PATCHING_CU_SOURCE_URL`, `PATCHING_CU_SOURCE_USERNAME`, dan `PATCHING_CU_SOURCE_PASSWORD`, bukan variabel Vite, komponen Vue, atau UI. Credential wajib berpasangan dan Basic Auth hanya diizinkan melalui HTTPS. Jangan menaruh credential di URL atau commit `.env`; gunakan environment/secret store platform untuk deployment perusahaan. `.env.example` hanya mendokumentasikan nama variabel tanpa nilai rahasia.

Adapter CU menerima satu atau lebih tuple `result[n]` dengan urutan `[Remediated Computer Count, Applicable Computer Count, Fixlet Name]`. Backend menjumlahkan seluruh row lalu mengubahnya menjadi kontrak bernama jelas:

```json
{
  "counts": {
    "patched": 249,
    "unpatched": 70
  },
  "total": 319,
  "progressPercent": 78.06,
  "sourceRowCount": 2,
  "retrievedAt": "2026-11-09T00:00:00.000Z"
}
```

`Remediated` setiap row dijumlahkan menjadi `patched`, sedangkan seluruh `Applicable` dijumlahkan menjadi `unpatched`. Total dan progress dihitung sekali di backend. Nilai ini merupakan akumulasi row; bila komputer yang sama terdapat pada beberapa Fixlet, komputer tersebut ikut terhitung pada setiap row sumber.

Endpoint `/api/devices` merespons HTTP 200 dengan `Content-Type: application/json`. Sebelum provider data nyata dihubungkan, respons validnya sengaja berupa array kosong:

```json
[]
```

`deviceService.js` tetap menjadi batas validasi detail report dan tidak memuat teks maupun warna tampilan. Endpoint detail perangkat kelak perlu mengirim array record canonical dengan field `id`, `hostname`, `ipAddress`, `osVersion`, `patchStatus`, `lastPatch`, dan `lastReportTime`. `patchStatus` hanya menerima `patched` atau `unpatched`; `lastPatch` menerima `YYYY-MM` atau `null`; `lastReportTime` memakai ISO 8601 lengkap dengan zona waktu.

## Menambah chart atau report baru

`dashboard_view.vue` menyusun satu domain CU dan lima placeholder doughnut kosong. Setiap domain baru menyusun `DashboardCard` sebagai box dan daftar perbandingan umum, serta `DashboardChart` sebagai renderer canvas. Isi khusus seperti title, label, warna, nilai, endpoint, agregasi, dan tujuan report tetap berada di file domain tersebut. Detail status di bawah chart baru muncul ketika file domain mengirim `items` ke `DashboardCard`; karena itu hanya CU yang menampilkannya saat ini.

Template `dashboard_chart.vue` menerima item berbentuk `{ key, label, value, color }`. Chart type yang tersedia adalah `doughnut`, `pie`, `polarArea`, `bar`, `horizontalBar`, dan `line`. Renderer, loading state, empty state, tooltip, angka, interaksi canvas, serta responsiveness tidak perlu disalin ke file domain baru.

Report mengikuti pasangan satu-ke-satu. `report_cu.vue` berpasangan dengan `dashboard_cu.vue`. Setiap report domain baru menyusun `ReportLayout` untuk shell halaman dan `ReportTable` untuk tabel. Title, deskripsi, endpoint, kolom, dan formatter tetap menjadi milik domain.

Saat domain baru siap, rename salah satu slot menjadi nama yang jelas, misalnya `dashboard_windows.vue`, lalu buat pasangannya `report_windows.vue`, ubah import di `dashboard_view.vue`, dan tambahkan route report di `main.js`. Template umum tidak perlu disalin.

## Route

- `/` - dashboard kartu chart
- `/reports` - seluruh perangkat
- `/reports?status=patched` - perangkat yang sudah di-patch
- `/reports?status=unpatched` - perangkat yang belum di-patch
- `/reports/slot-2` sampai `/reports/slot-6` - report kosong pasangan card placeholder

Tombol **Export CSV** mengunduh seluruh hasil pencarian dan filter yang aktif, bukan hanya 20 baris pada halaman pagination saat ini.

`Last Patch` adalah bulan CU terakhir yang berhasil dipasang dan tidak memiliki zona waktu. Nilai ini berbeda dari waktu perangkat melapor.

`Last Report Time` adalah waktu terakhir perangkat melapor dan ditampilkan dalam zona waktu ICT (UTC+7), bukan waktu patch dipasang.
