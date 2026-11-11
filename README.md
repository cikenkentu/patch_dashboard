# Patching Dashboard

Dashboard internal untuk menampilkan ringkasan dan report status patch perangkat. Frontend Vue dan backend Node disimpan dalam satu repository; data CU tetap menampilkan empty state sampai sumber dashboard atau report terkait terhubung. Lima card lain hanya menampilkan doughnut kosong tanpa status atau angka palsu.

## Menjalankan project

Prasyarat: Node.js 20.19+ dan npm.

```bash
npm install
npm run dev
```

`npm run dev` menjalankan frontend sekaligus route API lokal melalui handler backend yang sama. Salin `.env.example` menjadi `.env`, lalu isi URL dashboard pada `PATCHING_CU_SOURCE_URL`, URL report pada `PATCHING_CU_REPORT_SOURCE_URL`, serta credential bersama pada `PATCHING_CU_SOURCE_USERNAME` dan `PATCHING_CU_SOURCE_PASSWORD`. Script development, preview, dan backend mandiri memuat `.env` secara otomatis; perubahan konfigurasi berlaku setelah proses di-restart.

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
|-- server.js                         # HTTP server dan eksekusi route registry
|-- shared/
|   `-- jsonSourceClient.js           # Transport, auth, timeout, dan error reusable
`-- features/
    |-- routes.js                      # Registry lintas-feature + guard duplicate path
    `-- cu/
        |-- routes.js                 # Endpoint publik dan loader milik CU
        |-- dashboard/
        |   `-- cuDashboard.js        # Mapping/agregasi sumber dashboard CU
        `-- report/
            `-- cuReport.js           # Mapping tuple sumber report CU
frontend/
|-- index.html
`-- src/
    |-- app/
    |   |-- App.vue                   # Shell, header, dan style global
    |   `-- main.js                   # Bootstrap, PrimeVue, dan route UI
    |-- pages/
    |   `-- dashboard_view.vue        # Composition root grid lintas-feature
    |-- shared/
    |   |-- dashboard/
    |   |   |-- dashboard_card.vue    # Shell card reusable
    |   |   `-- dashboard_chart.vue   # Renderer Chart.js reusable
    |   `-- report/
    |       |-- report_layout.vue     # Shell halaman report reusable
    |       `-- report_table.vue      # Renderer PrimeVue DataTable reusable
    `-- features/
        |-- cu/
        |   |-- dashboard/
        |   |   |-- dashboard_cu.vue
        |   |   `-- cuDashboardService.js
        |   `-- report/
        |       |-- report_cu.vue
        |       `-- cuReportService.js
        `-- placeholders/             # Slot sementara, bukan template bersama
            |-- dashboard/dashboard_slot2..6.vue
            `-- report/report_slot2..6.vue
```

Aturan ownership-nya sederhana: sesuatu masuk `shared/` hanya bila dipakai lintas-feature dan tidak mengetahui endpoint, route feature, label, schema, atau aturan bisnis tertentu. Seluruh hal khusus CU berada di `features/cu/`, termasuk service frontend dan adapter backend. `pages/` hanya menyusun beberapa feature, sedangkan `app/` hanya menangani bootstrap dan shell aplikasi. Folder `placeholders/` menampung slot sementara agar kode kosong tersebut tidak dianggap template reusable.

Repository tetap satu monorepo dengan package/tooling di root, source browser di `frontend/`, dan API di `backend/`. Ini cocok selama frontend dan backend dimiliki tim serta siklus rilis yang sama. Pisahkan repository hanya jika keduanya nanti memiliki tim, versioning, akses, atau deployment lifecycle yang benar-benar berbeda.

Alur dashboard CU dapat dibaca linear: `frontend/src/features/cu/dashboard/dashboard_cu.vue` -> `cuDashboardService.js` -> `/api/dashboard/cu` -> `backend/features/cu/dashboard/cuDashboard.js` -> `backend/shared/jsonSourceClient.js` -> sumber internal. Report detail mengikuti folder pasangannya di `features/cu/report/`. Service tidak menyimpan label, warna, kolom, atau keputusan UI; detail tersebut berada di file feature yang menggunakannya.

## Ubah apa di mana

- Ubah mapping tuple dan aturan validasi ringkasan CU di `backend/features/cu/dashboard/cuDashboard.js`.
- Ubah kontrak canonical frontend ringkasan CU di `frontend/src/features/cu/dashboard/cuDashboardService.js`.
- Ubah mapping tuple dan aturan validasi detail report CU di `backend/features/cu/report/cuReport.js`.
- Ubah fetch atau validasi kontrak detail report CU di `frontend/src/features/cu/report/cuReportService.js`.
- Ubah endpoint publik atau pesan error CU di `backend/features/cu/routes.js`.
- Daftarkan kumpulan route feature baru di `backend/features/routes.js`; registry menolak path duplikat saat startup.
- Ubah transport JSON, Basic Auth, timeout, atau pemetaan error upstream bersama di `backend/shared/jsonSourceClient.js`.
- Ubah susunan card/grid atau daftar domain aktif di `frontend/src/pages/dashboard_view.vue`.
- Ubah title, label status, warna, agregasi, atau routing khusus card CU di `frontend/src/features/cu/dashboard/dashboard_cu.vue`.
- Ubah border, spacing, title, atau slot footer seluruh box di `frontend/src/shared/dashboard/dashboard_card.vue`.
- Ubah canvas, tipe, empty state, atau lifecycle Chart.js di `frontend/src/shared/dashboard/dashboard_chart.vue`.
- Ubah endpoint, query URL, label/filter status, kolom, atau formatter report CU di `frontend/src/features/cu/report/report_cu.vue`.
- Ubah back-link, susunan heading, atau state label seluruh report di `frontend/src/shared/report/report_layout.vue`.
- Ubah layout, filter, pagination, export CSV, atau style semua tabel di `frontend/src/shared/report/report_table.vue`.
- Ubah header, navigasi, atau style global di `frontend/src/app/App.vue`.
- Ubah route atau konfigurasi PrimeVue di `frontend/src/app/main.js`.

## Integrasi data

Dashboard dan report memakai pipeline terpisah karena response hitungan tidak memiliki hostname, IP, OS, Last Patch, atau Last Report Time. View tidak mengetahui alamat maupun credential sumber internal.

Alur yang disarankan:

```text
Dashboard CU -> GET /api/dashboard/cu -> Backend adapter -> BigFix/query internal
Report CU    -> GET /api/report/cu    -> Backend adapter -> BigFix/query internal
```

Frontend memakai endpoint same-origin berikut secara default:

```text
GET /api/dashboard/cu
GET /api/report/cu
GET /api/health
```

Saat development dan `npm run preview`, Vite memasang handler dari `backend/server.js` secara langsung. Untuk deployment, jalankan API dengan `npm run start:backend`, layani folder `dist` menggunakan web server perusahaan, lalu arahkan path `/api` ke backend melalui reverse proxy. Dengan pola same-origin ini frontend tidak membutuhkan CORS.

Frontend selalu memanggil route same-origin dan tidak mengetahui URL sumber. URL dashboard memakai environment server `PATCHING_CU_SOURCE_URL`, sedangkan URL report memakai `PATCHING_CU_REPORT_SOURCE_URL`. Keduanya memakai credential bersama `PATCHING_CU_SOURCE_USERNAME` dan `PATCHING_CU_SOURCE_PASSWORD` melalui `backend/shared/jsonSourceClient.js`. Semua variabel `VITE_*` dapat terlihat di browser, sehingga URL sumber dan credential tidak boleh dipindahkan ke variabel Vite, komponen Vue, atau UI. Credential wajib berpasangan dan Basic Auth hanya diizinkan melalui HTTPS. Jangan menaruh credential di URL atau commit `.env`; gunakan environment/secret store platform untuk deployment perusahaan. `.env.example` hanya mendokumentasikan nama variabel tanpa nilai rahasia.

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

Adapter report CU menerima setiap `result[n]` dalam urutan vendor yang tepat:

```text
[hostname, ipAddresses, osVersion, processor, lastReportTime]
```

`backend/features/cu/report/cuReport.js` memvalidasi setiap tuple lalu memetakannya ke record canonical berikut:

| Nilai sumber | Field canonical | Aturan |
|---|---|---|
| `hostname` | `id`, `hostname` | Hostname wajib unik; versi lowercase dipakai sebagai ID sementara. |
| `ipAddresses` | `ipAddress` | Daftar IP divalidasi, dideduplikasi, lalu disimpan sebagai string berseparator koma. |
| `osVersion` | `osVersion` | Teks OS dipertahankan setelah validasi. |
| `processor` | `processor` | Nilai dipertahankan dalam object/service untuk penggunaan mendatang, tetapi belum menjadi kolom tabel. |
| - | `patchStatus` | Selalu `null` karena endpoint report ini belum menyediakan status patch. |
| - | `lastPatch` | Selalu `null` karena endpoint report ini belum menyediakan bulan patch terakhir. |
| `lastReportTime` | `lastReportTime` | Waktu sumber wajib memiliki zona waktu lalu dinormalisasi menjadi ISO 8601 UTC. |

`frontend/src/features/cu/report/cuReportService.js` menjadi boundary validasi frontend untuk array canonical tersebut. `result: []` tetap valid dan ditampilkan sebagai empty state, bukan data palsu. Search hostname/IP, dropdown status, pagination, dan export CSV tetap memakai konfigurasi report yang sama. Karena `patchStatus` saat ini `null`, pilihan **Semua status** menampilkan data, sedangkan filter **Sudah di-patch** atau **Belum di-patch** baru menghasilkan data setelah sumber status tersedia. `Last Patch` juga tampil sebagai nilai kosong sampai field tersebut memiliki sumber resmi.

## Menambah chart atau report baru

`dashboard_view.vue` menyusun satu domain CU dan lima placeholder doughnut kosong. Setiap domain baru menyusun `DashboardCard` sebagai shell box serta `DashboardChart` sebagai renderer canvas. Isi khusus seperti title, label, warna, nilai, endpoint, agregasi, tujuan report, dan detail bawah card tetap berada di file domain tersebut. CU memakai dua count hanya sebagai dataset doughnut, sedangkan slot detail card menampilkan satu progress bar dari `progressPercent` backend. Klik chart atau link report CU membuka `/reports` tanpa filter sampai sumber report menyediakan `patchStatus` per perangkat.

Template `dashboard_chart.vue` menerima item berbentuk `{ key, label, value, color }`. Chart type yang tersedia adalah `doughnut`, `pie`, `polarArea`, `bar`, `horizontalBar`, dan `line`. Renderer, loading state, empty state, tooltip, angka, interaksi canvas, serta responsiveness tidak perlu disalin ke file domain baru.

Report mengikuti pasangan satu-ke-satu. `report_cu.vue` berpasangan dengan `dashboard_cu.vue`. Setiap report domain baru menyusun `ReportLayout` untuk shell halaman dan `ReportTable` untuk tabel. Title, deskripsi, endpoint, kolom, dan formatter tetap menjadi milik domain.

Saat domain baru siap, buat folder sejajar dengan CU: `frontend/src/features/<domain>/{dashboard,report}/` dan `backend/features/<domain>/{dashboard,report}/`. Endpoint, service, mapping sumber, tipe chart, label, warna, kolom, dan formatter tinggal di feature tersebut. Komponen dari `frontend/src/shared/` cukup di-import, bukan disalin. Terakhir, daftarkan card pada `pages/dashboard_view.vue`, route UI pada `app/main.js`, dan kumpulan route backend pada `backend/features/routes.js`. Hapus pasangan slot placeholder yang digantikan.

## Route

- `/` - dashboard kartu chart
- `/reports` - seluruh perangkat
- `/reports?status=patched` - perangkat yang sudah di-patch
- `/reports?status=unpatched` - perangkat yang belum di-patch
- `/reports/slot-2` sampai `/reports/slot-6` - report kosong pasangan card placeholder

Tombol **Export CSV** mengunduh seluruh hasil pencarian dan filter yang aktif, bukan hanya 20 baris pada halaman pagination saat ini.

`Last Patch` adalah bulan CU terakhir yang berhasil dipasang dan tidak memiliki zona waktu. Nilai ini berbeda dari waktu perangkat melapor.

`Last Report Time` adalah waktu terakhir perangkat melapor dan ditampilkan dalam zona waktu ICT (UTC+7), bukan waktu patch dipasang.
