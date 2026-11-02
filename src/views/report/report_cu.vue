<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { fetchDevices, PATCH_STATUS } from '../../services/deviceService'

// Report mengelola state URL, filter lokal, tabel, dan export; akses API tetap melalui service.
const REPORT_TIME_ZONE_LABEL = 'ICT (UTC+7)'
// Zona waktu IANA eksplisit menjaga hasil konsisten di setiap workstation.
// API tetap harus mengirim timestamp ISO 8601 dengan Z/offset agar waktu sumber tidak ambigu.
const reportTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Bangkok',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
// Ringkasan report mengikuti format angka dashboard agar ribuan mudah dipindai.
const deviceCountFormatter = new Intl.NumberFormat('id-ID')
const formatDeviceCount = (value) => deviceCountFormatter.format(value)

const route = useRoute()
const router = useRouter()
const devices = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const searchTerm = ref('')
// PrimeVue menyimpan posisi pagination sebagai offset baris berbasis nol.
const first = ref(0)
// Bind jumlah baris supaya label paginator custom tetap sinkron saat pilihan 10/20 berubah.
const rows = ref(20)
// Ref DataTable hanya dipakai untuk memanggil API exportCSV milik PrimeVue.
const dataTable = ref(null)

// Query URL adalah input eksternal; hanya enum domain yang dikenal boleh masuk ke state UI.
const validStatuses = ['patched', 'unpatched']
const normalizeStatus = (status) => validStatuses.includes(status) ? status : null
const statusFilter = ref(normalizeStatus(route.query.status))

// Label berasal dari metadata bersama agar dropdown, chart, tag, dan CSV selalu konsisten.
const statusOptions = [
  { label: 'Semua status', value: null },
  { label: PATCH_STATUS.patched.label, value: 'patched' },
  { label: PATCH_STATUS.unpatched.label, value: 'unpatched' },
]

// Prototype memfilter snapshot di browser agar implementasi mudah diikuti.
// Saat API mendukung server-side filter, kirim status/search melalui service tanpa mengubah query URL.
const filteredDevices = computed(() => {
  const query = searchTerm.value.trim().toLocaleLowerCase('id-ID')

  return devices.value.filter((device) => {
    const matchesStatus = !statusFilter.value || device.patchStatus === statusFilter.value
    const matchesSearch = !query
      || device.hostname.toLocaleLowerCase('id-ID').includes(query)
      || device.ipAddress.includes(query)

    return matchesStatus && matchesSearch
  })
})

const hasSearch = computed(() => Boolean(searchTerm.value.trim()))
const hasActiveFilters = computed(() => Boolean(searchTerm.value.trim() || statusFilter.value))
// Pagination dan export hanya aktif bila benar-benar ada hasil yang dapat diproses.
const hasResults = computed(() => filteredDevices.value.length > 0)
const canExport = computed(() => !isLoading.value && !errorMessage.value && hasResults.value)

// Nama file memakai tanggal ICT agar konsisten dengan zona waktu yang terlihat pada report.
const exportFilename = computed(() => {
  const scope = statusFilter.value ?? 'semua-status'
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date())

  return `laporan-patch-${scope}-${date}`
})
const reportTitle = computed(() => {
  if (statusFilter.value === 'patched') return 'Perangkat sudah di-patch'
  if (statusFilter.value === 'unpatched') return 'Perangkat belum di-patch'
  return 'Daftar perangkat'
})
const resultLabel = computed(() => {
  if (isLoading.value) return 'Memuat data…'
  if (!devices.value.length) return 'Data belum tersedia'
  if (!hasActiveFilters.value) return `${formatDeviceCount(devices.value.length)} perangkat`
  return `${formatDeviceCount(filteredDevices.value.length)} dari ${formatDeviceCount(devices.value.length)} perangkat`
})
const pageReportLabel = computed(() => {
  if (!hasResults.value) return ''

  const pageFirst = first.value + 1
  const pageLast = Math.min(first.value + rows.value, filteredDevices.value.length)
  return `Menampilkan ${formatDeviceCount(pageFirst)}–${formatDeviceCount(pageLast)} dari ${formatDeviceCount(filteredDevices.value.length)}`
})
const emptyTitle = computed(() => (
  devices.value.length ? 'Tidak ada perangkat yang sesuai filter' : 'Data belum tersedia'
))
const emptyDescription = computed(() => (
  devices.value.length
    ? 'Ubah pencarian atau filter status, lalu coba kembali.'
    : 'Data akan tampil setelah sumber data terhubung.'
))

// Reset pencarian sengaja mempertahankan status pilihan dan deep link query URL.
function resetSearch() {
  searchTerm.value = ''
}

function formatReportTime(value) {
  // Satu timestamp kosong/tidak valid tidak boleh menggagalkan render seluruh tabel.
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return reportTimeFormatter.format(date).replace('.', ':')
}

function getStatus(status) {
  // Fallback menjaga tabel tetap terbaca bila backend sementara mengirim enum baru.
  return PATCH_STATUS[status] ?? { label: 'Tidak diketahui' }
}

/**
 * Mengubah nilai sel PrimeVue menjadi teks CSV yang aman dan sesuai tampilan pengguna.
 * @param {{ data: unknown, field: string }} context Konteks sel dari export DataTable.
 * @returns {string}
 */
function formatCsvCell({ data, field }) {
  let value = data

  // Export label/waktu yang dibaca pengguna, bukan enum internal atau timestamp mentah.
  if (field === 'patchStatus') value = getStatus(data).label
  if (field === 'lastReportTime') value = formatReportTime(data)

  const text = String(value ?? '')
  // Lindungi CSV injection: spreadsheet tidak boleh mengeksekusi nilai API sebagai formula.
  const safeText = /^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text) ? `'${text}` : text

  return safeText.replace(/"/g, '""')
}

// PrimeVue mengekspor seluruh hasil filter/sort, bukan hanya 20 baris halaman aktif.
function exportCsv() {
  if (canExport.value) dataTable.value?.exportCSV()
}

// URL -> UI: sanitasi deep link dan sinkronkan dropdown saat refresh/back/forward.
watch(() => route.query.status, (status) => {
  const normalizedStatus = normalizeStatus(status)
  const hasStatusQuery = Object.hasOwn(route.query, 'status')

  if (hasStatusQuery && !normalizedStatus) {
    const query = { ...route.query }
    delete query.status
    router.replace({ name: 'reports', query })
  }

  if (normalizedStatus !== statusFilter.value) statusFilter.value = normalizedStatus
}, { immediate: true })

watch(statusFilter, (status) => {
  // UI -> URL: pertahankan query lain dan gunakan replace agar dropdown tidak memenuhi history.
  const query = { ...route.query }
  const routeStatus = normalizeStatus(route.query.status)

  if (status) query.status = status
  else delete query.status

  // Perbandingan nilai pada kedua watcher mencegah loop sinkronisasi dua arah.
  if (routeStatus !== status) router.replace({ name: 'reports', query })
  first.value = 0
})

watch(searchTerm, () => {
  // Filter baru kembali ke halaman pertama agar offset lama tidak membuat hasil tampak kosong.
  first.value = 0
})

// View selalu mengambil data lewat service; endpoint, validasi, dan detail BigFix tidak bocor ke UI.
onMounted(async () => {
  try {
    devices.value = await fetchDevices()
  } catch (error) {
    errorMessage.value = 'Data perangkat belum dapat dimuat.'
    console.error(error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <section class="report-page" aria-labelledby="reports-title">
    <RouterLink class="back-link" to="/">Kembali ke dashboard</RouterLink>

    <div class="report-heading">
      <h1 id="reports-title">{{ reportTitle }}</h1>
      <!-- aria-live mengumumkan perubahan jumlah tanpa memindahkan fokus pengguna keyboard. -->
      <p class="result-count" aria-live="polite">{{ resultLabel }}</p>
    </div>

    <section class="report-content" aria-label="Daftar perangkat">
      <!-- Filter berada di luar tabel agar tetap mudah ditemukan saat data panjang. -->
      <div class="report-toolbar">
        <label class="filter-field filter-field--search">
          <span>Cari perangkat</span>
          <InputText
            v-model="searchTerm"
            type="search"
            placeholder="Cari hostname atau IP"
            aria-label="Cari berdasarkan hostname atau IP address"
          />
        </label>

        <label class="filter-field">
          <span>Filter status</span>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            aria-label="Filter patch status"
          />
        </label>

        <Button
          v-if="hasSearch"
          class="reset-search-button"
          label="Reset pencarian"
          severity="secondary"
          text
          @click="resetSearch"
        />

        <Button
          class="export-csv-button"
          label="Export CSV"
          severity="secondary"
          outlined
          :disabled="!canExport"
          aria-label="Export seluruh hasil filter ke CSV"
          @click="exportCsv"
        />
      </div>

      <div v-if="errorMessage" class="error-state" role="alert">
        {{ errorMessage }}
      </div>

      <div v-else class="data-table-wrapper">
        <!-- View memfilter data; PrimeVue menangani sort, pagination, dan serialisasi CSV. -->
        <!-- data-key harus tetap unik/stabil agar identitas baris tidak berubah saat sorting. -->
        <DataTable
          ref="dataTable"
          v-model:first="first"
          v-model:rows="rows"
          :value="filteredDevices"
          :loading="isLoading"
          data-key="id"
          :paginator="hasResults"
          :rows-per-page-options="[10, 20]"
          scrollable
          scroll-height="flex"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          removable-sort
          striped-rows
          :export-filename="exportFilename"
          :export-function="formatCsvCell"
          :table-props="{ 'aria-label': 'Daftar perangkat dan status patch' }"
          table-style="width: 100%; table-layout: fixed"
          class="device-table"
          :class="{ 'device-table--empty': !isLoading && filteredDevices.length === 0 }"
        >
          <!-- Slot custom diperlukan karena report bawaan PrimeVue tidak memformat angka ribuan. -->
          <template #paginatorend>
            <span class="localized-page-report" aria-live="polite">{{ pageReportLabel }}</span>
          </template>

          <Column field="hostname" header="Hostname" sortable style="width: 24%">
            <template #body="{ data }">
              <span class="hostname-cell">{{ data.hostname }}</span>
            </template>
          </Column>
          <Column field="ipAddress" header="IP Address" sortable style="width: 13%">
            <template #body="{ data }">
              <span class="ip-cell">{{ data.ipAddress }}</span>
            </template>
          </Column>
          <Column field="osVersion" header="OS Version" sortable style="width: 29%">
            <template #body="{ data }">
              <span class="os-cell">{{ data.osVersion }}</span>
            </template>
          </Column>
          <Column field="patchStatus" header="Patch Status" sortable style="width: 14%">
            <template #body="{ data }">
              <Tag
                :value="getStatus(data.patchStatus).label"
                :severity="data.patchStatus === 'patched' ? 'success' : 'warn'"
              />
            </template>
          </Column>
          <Column
            field="lastReportTime"
            export-header="Last Report Time (ICT UTC+7)"
            sortable
            style="width: 20%"
          >
            <template #header>
              <span class="time-header">
                Last Report Time
                <small>{{ REPORT_TIME_ZONE_LABEL }}</small>
              </span>
            </template>
            <template #body="{ data }">
              <!-- datetime mempertahankan nilai API; format ICT hanya menjadi teks yang terlihat. -->
              <time :datetime="data.lastReportTime">{{ formatReportTime(data.lastReportTime) }}</time>
            </template>
          </Column>

          <!-- Empty state membedakan sumber kosong dari filter yang tidak menemukan hasil. -->
          <template #empty>
            <div class="table-empty-state">
              <strong>{{ emptyTitle }}</strong>
              <p>{{ emptyDescription }}</p>
              <Button
                v-if="hasSearch && devices.length"
                label="Reset pencarian"
                severity="secondary"
                outlined
                @click="resetSearch"
              />
            </div>
          </template>
        </DataTable>
      </div>
    </section>
  </section>
</template>

<style>
/* Sengaja tidak scoped karena selector ini menata markup internal buatan PrimeVue. */
/* Header report dan kontrol filter. */
.back-link {
  display: inline-block;
  margin-bottom: 1.2rem;
  color: var(--link);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}

.back-link:hover,
.back-link:focus-visible {
  text-decoration: underline;
}

.report-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
}

.result-count {
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.report-page {
  /* min-height: 0 pada rantai flex membuat body tabel yang scroll, bukan seluruh shell halaman. */
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
}

.report-content {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  border: 0;
  background: transparent;
}

.report-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  padding: 0 0 1rem;
  border-bottom: 0;
}

.filter-field {
  display: grid;
  width: 230px;
  gap: 0.4rem;
}

.filter-field--search {
  width: min(360px, 100%);
}

.filter-field > span {
  color: #475467;
  font-size: 0.875rem;
  font-weight: 600;
}

.filter-field .p-inputtext,
.filter-field .p-select {
  width: 100%;
  border-radius: 3px;
}

.reset-search-button {
  margin-bottom: 0.05rem;
}

.export-csv-button {
  flex: 0 0 auto;
  margin-left: auto;
}

/* Layout DataTable mengisi tinggi halaman; hanya area baris yang scroll ketika data panjang. */
.data-table-wrapper {
  display: flex;
  width: 100%;
  min-height: 20rem;
  flex: 1 1 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface);
}

.data-table-wrapper > .device-table.p-datatable {
  display: flex;
  min-width: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
}

.device-table .p-datatable-table-container {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
}

.device-table .p-datatable-thead > tr > th {
  padding: 0.9rem 1rem;
  border-color: var(--border-light);
  color: #344054;
  background: #f2f4f7;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
}

.device-table .p-datatable-column-header-content {
  gap: 0.4rem;
}

.device-table .p-datatable-tbody > tr > td {
  padding: 0.85rem 1rem;
  border-color: var(--border-light);
  color: #344054;
  font-size: 0.9375rem;
  line-height: 1.5;
  vertical-align: middle;
}

.device-table .p-datatable-tbody > tr:nth-child(even) {
  background: #fafbfc;
}

.device-table .p-paginator {
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-top: 1px solid var(--border);
  border-radius: 0;
}

.localized-page-report {
  color: var(--muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.device-table .p-tag {
  border-radius: 3px;
  white-space: nowrap;
}

.hostname-cell,
.os-cell {
  /* Hostname/OS panjang dibungkus di kolomnya tanpa memperlebar halaman. */
  display: block;
  width: 100%;
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: normal;
  line-height: 1.5;
}

.hostname-cell {
  color: var(--text);
  font-weight: 650;
}

.ip-cell {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.device-table time {
  display: block;
  white-space: normal;
  font-variant-numeric: tabular-nums;
}

.time-header {
  display: inline-flex;
  flex-direction: column;
  gap: 0.1rem;
}

.time-header small {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 500;
}

.table-empty-state {
  display: grid;
  max-width: 460px;
  margin: 0 auto;
  place-items: center;
  padding: 3.5rem 1.5rem;
  color: var(--muted);
  text-align: center;
}

.table-empty-state strong {
  margin-bottom: 0.35rem;
  color: var(--text);
}

.table-empty-state p {
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

/* Hanya tabel kosong yang direntangkan agar pesan berada di tengah area. */
.device-table--empty .p-datatable-table-container {
  display: flex;
  flex-direction: column;
}

.device-table--empty .p-datatable-table {
  height: 100%;
  flex: 1 0 auto;
}

.device-table--empty .p-datatable-tbody,
.device-table--empty .p-datatable-tbody > tr,
.device-table--empty .p-datatable-tbody > tr > td {
  height: 100%;
}

.device-table--empty .p-datatable-tbody > tr > td {
  padding: 0;
}

.device-table--empty .table-empty-state {
  display: grid;
  height: 100%;
  min-height: 14rem;
  align-content: center;
  justify-items: center;
  padding: 2rem 1.5rem;
}

.error-state {
  padding: 2rem 1rem;
  color: #b42318;
  text-align: center;
}

@media (min-width: 901px) and (max-width: 1200px) {
  .device-table .p-datatable-thead > tr > th,
  .device-table .p-datatable-tbody > tr > td {
    padding-inline: 0.7rem;
  }
}

@media (max-width: 960px) {
  /* Pertahankan lebar minimum kolom agar terbaca; wrapper menyediakan scroll horizontal lokal. */
  .device-table .p-datatable-table {
    min-width: 62rem;
  }
}

@media (max-width: 760px) {
  .report-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.4rem;
  }

  .report-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 0.75rem;
  }

  .filter-field,
  .filter-field--search {
    width: 100%;
  }

  .reset-search-button {
    align-self: flex-start;
  }

  .export-csv-button {
    align-self: flex-start;
    margin-left: 0;
  }

  .device-table--empty .table-empty-state {
    /* Tabel tetap lebar; tempel pesan kosong ke viewport agar tidak berada di luar layar. */
    position: sticky;
    left: 0;
    width: calc(100vw - 30px);
    max-width: none;
    min-height: 12rem;
    margin: 0;
  }
}
</style>
