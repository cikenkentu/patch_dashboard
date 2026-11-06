<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchDevices } from '../../services/deviceService'
import DashboardCard from './dashboard_card.vue'
import DashboardChart from './dashboard_chart.vue'

// Label, warna, dan nilai status adalah keputusan presentasi khusus dashboard CU.
// Menaruhnya di sini membuat service data tetap bebas dari detail UI.
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

// Kartu domain CU hanya memegang fetch, agregasi, presentasi, dan tujuan report miliknya.
const CU_DASHBOARD = Object.freeze({
  title: 'CU Patch',
  chartType: 'doughnut',
  reportPath: '/reports',
  valueUnit: 'perangkat',
  interactive: true,
  dataSource: fetchDevices,
})

const router = useRouter()
const devices = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const summary = computed(() => {
  const patched = devices.value.filter((device) => device.patchStatus === 'patched').length
  const unpatched = devices.value.filter((device) => device.patchStatus === 'unpatched').length
  return { total: devices.value.length, patched, unpatched }
})

const items = computed(() => [
  {
    key: CU_PATCH_STATUS.patched.value,
    label: CU_PATCH_STATUS.patched.label,
    value: summary.value.patched,
    color: CU_PATCH_STATUS.patched.color,
  },
  {
    key: CU_PATCH_STATUS.unpatched.value,
    label: CU_PATCH_STATUS.unpatched.label,
    value: summary.value.unpatched,
    color: CU_PATCH_STATUS.unpatched.color,
  },
])

const canSelectStatus = computed(() => (
  summary.value.total > 0 && !isLoading.value && !errorMessage.value
))

function openReport(status) {
  if (!CU_PATCH_STATUS[status]) return
  router.push({ path: CU_DASHBOARD.reportPath, query: { status } })
}

// Empty state tetap menuju report CU; tanpa status berarti report menampilkan semua hasil (saat tersedia).
function openEmptyReport() {
  router.push(CU_DASHBOARD.reportPath)
}

async function loadData() {
  try {
    devices.value = await CU_DASHBOARD.dataSource()
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
  <!-- File domain merangkai shell + renderer, lalu menambahkan detail khusus CU. -->
  <DashboardCard
    :title="CU_DASHBOARD.title"
    :items="items"
    :has-data="summary.total > 0"
    :details-interactive="canSelectStatus"
    :details-label="`Status ${CU_DASHBOARD.title}`"
    @select-item="openReport"
  >
    <DashboardChart
      :title="CU_DASHBOARD.title"
      :chart-type="CU_DASHBOARD.chartType"
      :value-unit="CU_DASHBOARD.valueUnit"
      :items="items"
      :total="summary.total"
      :has-data="summary.total > 0"
      :is-loading="isLoading"
      :error-message="errorMessage"
      :interactive="CU_DASHBOARD.interactive"
      allow-empty-selection
      @select-item="openReport"
      @select-empty="openEmptyReport"
    />
  </DashboardCard>
</template>
