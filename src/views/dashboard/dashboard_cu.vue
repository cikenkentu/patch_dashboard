<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchCuDashboardSummary } from '../../services/cuDashboardService'
import DashboardCard from './dashboard_card.vue'
import DashboardChart from './dashboard_chart.vue'

/**
 * Composition root khusus domain CU.
 * File ini memiliki konfigurasi status, pemanggilan service, mapping kontrak API ke item visual,
 * dan routing report. Card serta chart tetap reusable karena tidak mengenal istilah patch CU.
 */

// Label dan warna adalah keputusan presentasi CU; service hanya mengembalikan data canonical.
const CU_PATCH_STATUS = Object.freeze({
  patched: {
    value: 'patched',
    label: 'Sudah di-patch',
    color: '#2f6b4f',
  },
  unpatched: {
    value: 'unpatched',
    label: 'Belum di-patch',
    color: '#8c2f45',
  },
})

// Konfigurasi domain mengumpulkan keputusan yang lazim berubah saat chart baru ditambahkan.
const CU_DASHBOARD = Object.freeze({
  title: 'CU Patch',
  chartType: 'doughnut',
  reportPath: '/reports',
  valueUnit: 'perangkat',
  interactive: true,
  dataSource: fetchCuDashboardSummary,
})

const router = useRouter()

// Invariant data: summary null berarti belum ada payload canonical. Object dengan total 0 tetap
// respons sukses dan berbeda dari loading/error, sehingga UI tidak memalsukan angka saat request gagal.
const summary = ref(null)
const isLoading = ref(true)
const errorMessage = ref('')

const total = computed(() => summary.value?.total ?? 0)
const hasData = computed(() => summary.value !== null)
const percentageFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 })
const progressLabel = computed(() => (
  summary.value?.progressPercent == null
    ? ''
    : `${percentageFormatter.format(summary.value.progressPercent)}% selesai`
))

// Boundary mapping ini adalah satu-satunya bentuk data yang dipahami Card dan Chart.
const items = computed(() => [
  {
    key: CU_PATCH_STATUS.patched.value,
    label: CU_PATCH_STATUS.patched.label,
    value: summary.value?.counts.patched ?? 0,
    color: CU_PATCH_STATUS.patched.color,
  },
  {
    key: CU_PATCH_STATUS.unpatched.value,
    label: CU_PATCH_STATUS.unpatched.label,
    value: summary.value?.counts.unpatched ?? 0,
    color: CU_PATCH_STATUS.unpatched.color,
  },
])

const canSelectStatus = computed(() => (
  total.value > 0 && !isLoading.value && !errorMessage.value
))

// Event renderer berisi key domain; hanya file CU yang menerjemahkannya menjadi query report.
function openReport(status) {
  if (!CU_PATCH_STATUS[status]) return
  router.push({ path: CU_DASHBOARD.reportPath, query: { status } })
}

// Empty state tetap menuju report CU; tanpa status berarti report menampilkan semua hasil (saat tersedia).
function openEmptyReport() {
  router.push(CU_DASHBOARD.reportPath)
}

async function loadData() {
  // Service memvalidasi payload sebelum assignment; kegagalan tidak pernah menghasilkan summary parsial.
  try {
    summary.value = await CU_DASHBOARD.dataSource()
  } catch (error) {
    errorMessage.value = 'Data gagal dimuat.'
    console.error('Data CU belum dapat dimuat.', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <!-- Domain merangkai dua layer reusable; prop/event di bawah adalah boundary antarlayer. -->
  <DashboardCard
    :title="CU_DASHBOARD.title"
    :items="items"
    :has-data="hasData"
    :details-interactive="canSelectStatus"
    :details-label="`Status ${CU_DASHBOARD.title}`"
    @select-item="openReport"
  >
    <DashboardChart
      :title="CU_DASHBOARD.title"
      :chart-type="CU_DASHBOARD.chartType"
      :value-unit="CU_DASHBOARD.valueUnit"
      :center-detail="progressLabel"
      :items="items"
      :total="total"
      :has-data="hasData"
      :is-loading="isLoading"
      :error-message="errorMessage"
      :interactive="CU_DASHBOARD.interactive"
      allow-empty-selection
      @select-item="openReport"
      @select-empty="openEmptyReport"
    />
  </DashboardCard>
</template>
