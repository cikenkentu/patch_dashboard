<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchDevices } from '../../services/deviceService'
import ReportLayout from './report_layout.vue'
import ReportTable from './report_table.vue'

// Domain composer CU adalah satu tempat untuk API, schema, filter, format, dan sinkronisasi route.
// Ia merangkai ReportLayout + ReportTable tanpa memindahkan aturan CU ke komponen reusable.
const CU_REPORT = Object.freeze({
  routeName: 'reports',
  dataSource: fetchDevices,
  searchFields: ['hostname', 'ipAddress'],
  statusField: 'patchStatus',
})

// Metadata presentasi CU tinggal di file domain agar service data dan template tabel tetap netral.
const CU_PATCH_STATUS = Object.freeze({
  patched: Object.freeze({
    value: 'patched',
    label: 'Sudah di-patch',
    severity: 'success',
    cellClass: 'cu-status-tag cu-status-tag--patched',
  }),
  unpatched: Object.freeze({
    value: 'unpatched',
    label: 'Belum di-patch',
    severity: 'danger',
    cellClass: 'cu-status-tag cu-status-tag--unpatched',
  }),
})

// Konversi zona waktu adalah keputusan domain; nilai canonical dari service tetap tidak diubah.
const reportTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Bangkok',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const patchMonthFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'UTC',
  month: 'short',
  year: 'numeric',
})
const deviceCountFormatter = new Intl.NumberFormat('id-ID')
const formatDeviceCount = (value) => deviceCountFormatter.format(value)

function formatReportTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : reportTimeFormatter.format(date).replace('.', ':')
}

function formatLastPatch(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? '')
  if (!match) return '—'

  return patchMonthFormatter.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
}

function getStatus(status) {
  return CU_PATCH_STATUS[status] ?? {
    label: 'Tidak diketahui',
    severity: 'secondary',
    cellClass: 'cu-status-tag',
  }
}

// Definisi kolom berada di domain CU; template PrimeVue tidak perlu mengetahui nama field API.
const columns = Object.freeze([
  { field: 'hostname', header: 'Hostname', width: '20%', cellClass: 'hostname-cell' },
  { field: 'ipAddress', header: 'IP Address', width: '12%', cellClass: 'ip-cell' },
  { field: 'osVersion', header: 'OS Version', width: '23%', cellClass: 'os-cell' },
  {
    field: 'patchStatus',
    header: 'Patch Status',
    width: '13%',
    type: 'status',
    formatter: (value) => getStatus(value).label,
    severity: (value) => getStatus(value).severity,
    cellClass: (value) => getStatus(value).cellClass,
  },
  {
    field: 'lastPatch',
    header: 'Last Patch',
    width: '12%',
    formatter: formatLastPatch,
  },
  {
    field: 'lastReportTime',
    header: 'Last Report Time',
    subheader: 'ICT (UTC+7)',
    exportHeader: 'Last Report Time (ICT UTC+7)',
    width: '20%',
    type: 'time',
    formatter: formatReportTime,
  },
])

// Opsi filter berasal dari metadata status yang sama agar label tabel dan toolbar tidak menyimpang.
const statusOptions = Object.freeze([
  { label: 'Semua status', value: null },
  { label: CU_PATCH_STATUS.patched.label, value: CU_PATCH_STATUS.patched.value },
  { label: CU_PATCH_STATUS.unpatched.label, value: CU_PATCH_STATUS.unpatched.value },
])
const validStatuses = Object.keys(CU_PATCH_STATUS)
const normalizeStatus = (status) => validStatuses.includes(status) ? status : null

const route = useRoute()
const router = useRouter()
// View domain memiliki lifecycle request dan filter; layout/table hanya menerima state yang sudah siap tampil.
const devices = ref([])
const isLoading = ref(true)
const errorMessage = ref('')
const searchTerm = ref('')
const statusFilter = ref(normalizeStatus(route.query.status))

// Filtering adalah aturan domain. Jika kelak server-side, kontrak ReportTable tetap menerima `items` terfilter.
const filteredDevices = computed(() => {
  const query = searchTerm.value.trim().toLocaleLowerCase('id-ID')

  return devices.value.filter((device) => {
    const matchesStatus = !statusFilter.value
      || device[CU_REPORT.statusField] === statusFilter.value
    const matchesSearch = !query || CU_REPORT.searchFields.some((field) => (
      String(device[field] ?? '').toLocaleLowerCase('id-ID').includes(query)
    ))

    return matchesStatus && matchesSearch
  })
})

// Label hasil dan empty-state diturunkan di sini supaya renderer tidak menebak makna data CU.
const hasActiveFilters = computed(() => Boolean(searchTerm.value.trim() || statusFilter.value))
const reportTitle = computed(() => {
  if (statusFilter.value === 'patched') return 'Perangkat sudah di-patch'
  if (statusFilter.value === 'unpatched') return 'Perangkat belum di-patch'
  return 'Daftar perangkat CU'
})
const resultLabel = computed(() => {
  if (isLoading.value) return 'Memuat data…'
  if (!devices.value.length) return 'Data belum tersedia'
  if (!hasActiveFilters.value) return `${formatDeviceCount(devices.value.length)} perangkat`
  return `${formatDeviceCount(filteredDevices.value.length)} dari ${formatDeviceCount(devices.value.length)} perangkat`
})
const emptyTitle = computed(() => (
  devices.value.length ? 'Tidak ada perangkat yang sesuai filter' : 'Data belum tersedia'
))
const emptyDescription = computed(() => (
  devices.value.length
    ? 'Ubah pencarian atau filter status, lalu coba kembali.'
    : 'Data akan tampil setelah sumber data terhubung.'
))
// Nama file membawa scope dan tanggal audit; serialisasi serta sanitasi sel tetap milik ReportTable.
const exportFilename = computed(() => {
  const scope = statusFilter.value ?? 'semua-status'
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date())
  return `laporan-patch-cu-${scope}-${date}`
})

// URL -> UI: sanitasi deep link dan sinkronkan dropdown saat refresh/back/forward.
watch(() => route.query.status, (status) => {
  const normalizedStatus = normalizeStatus(status)
  const hasStatusQuery = Object.hasOwn(route.query, 'status')

  if (hasStatusQuery && !normalizedStatus) {
    const query = { ...route.query }
    delete query.status
    router.replace({ name: CU_REPORT.routeName, query })
  }

  if (normalizedStatus !== statusFilter.value) statusFilter.value = normalizedStatus
}, { immediate: true })

// UI -> URL: pertahankan query lain tanpa memenuhi browser history.
watch(statusFilter, (status) => {
  const query = { ...route.query }
  const routeStatus = normalizeStatus(route.query.status)

  if (status) query.status = status
  else delete query.status
  if (routeStatus !== status) router.replace({ name: CU_REPORT.routeName, query })
})

async function loadData() {
  // Service memvalidasi boundary JSON; view hanya memiliki state request yang terlihat pengguna.
  try {
    devices.value = await CU_REPORT.dataSource()
  } catch (error) {
    errorMessage.value = 'Data perangkat belum dapat dimuat.'
    console.error('Report CU belum dapat dimuat.', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <!-- Komposisi domain: shell halaman menerima heading/state, renderer menerima data dan capability opt-in. -->
  <ReportLayout
    title-id="reports-title"
    :title="reportTitle"
    :state-label="resultLabel"
  >
    <ReportTable
      v-model:search-term="searchTerm"
      v-model:status-filter="statusFilter"
      :aria-label="reportTitle"
      :items="filteredDevices"
      :source-count="devices.length"
      :columns="columns"
      :status-options="statusOptions"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      :export-filename="exportFilename"
      :is-loading="isLoading"
      :error-message="errorMessage"
      data-key="id"
      search-label="Cari perangkat"
      search-placeholder="Cari hostname atau IP"
      status-filter-label="Filter status"
      show-search
      show-status-filter
      show-export
      show-pagination
    />
  </ReportLayout>
</template>

<style scoped>
/* Sel khusus perangkat CU tinggal dekat definisi kolomnya, bukan di template tabel umum. */
:deep(.hostname-cell),
:deep(.os-cell) {
  display: block;
  width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
  white-space: normal;
}

:deep(.hostname-cell) {
  color: var(--text);
  font-weight: 650;
}

:deep(.ip-cell) {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* Warna status mengikuti palet CU: hijau gelap dan burgundy, bukan warna bawaan chart. */
:deep(.cu-status-tag--patched.p-tag) {
  color: #ffffff;
  background: #2f6b4f;
}

:deep(.cu-status-tag--unpatched.p-tag) {
  color: #ffffff;
  background: #8c2f45;
}
</style>
