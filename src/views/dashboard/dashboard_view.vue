<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchDevices, PATCH_STATUS } from '../../services/deviceService'
import DashboardCU from './dashboard_cu.vue'
import DashboardDummy1 from './dashboard_dummy1.vue'
import DashboardDummy2 from './dashboard_dummy2.vue'
import DashboardDummy3 from './dashboard_dummy3.vue'
import DashboardDummy4 from './dashboard_dummy4.vue'
import DashboardDummy5 from './dashboard_dummy5.vue'

// Controller halaman: satu tempat untuk request, state bersama, layout, dan navigasi report.
// Vue memakai composition melalui props/events, bukan inheritance antar-komponen.
const router = useRouter()

// Snapshot kanonis ini menjadi sumber angka semua widget pada satu kali pemuatan dashboard.
const devices = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

// Ringkasan dihitung sekali di controller agar setiap widget selalu menampilkan angka yang sama.
const summary = computed(() => {
  const patched = devices.value.filter((device) => device.patchStatus === 'patched').length
  const unpatched = devices.value.filter((device) => device.patchStatus === 'unpatched').length

  return {
    total: devices.value.length,
    patched,
    unpatched,
  }
})

// Urutan status adalah kontrak pemetaan warna, segmen chart, tooltip, dan tujuan report.
const statusItems = computed(() => [
  { ...PATCH_STATUS.patched, count: summary.value.patched },
  { ...PATCH_STATUS.unpatched, count: summary.value.unpatched },
])

const hasData = computed(() => summary.value.total > 0)

// Kontrak props bersama: CU dan widget lain menerima data siap tampil tanpa melakukan fetch sendiri.
const chartProps = computed(() => ({
  statusItems: statusItems.value,
  total: summary.value.total,
  hasData: hasData.value,
  isLoading: isLoading.value,
  errorMessage: errorMessage.value,
}))

// Widget hanya mengirim enum status; controller memutuskan route dan bentuk query URL.
function openStatusReport(status) {
  // Guard mencegah nilai widget yang tidak dikenal masuk ke kontrak URL report.
  if (!['patched', 'unpatched'].includes(status)) return
  router.push({ name: 'reports', query: { status } })
}

// Satu-satunya fetch dashboard; endpoint dan transformasi respons tetap milik deviceService.
onMounted(async () => {
  try {
    devices.value = await fetchDevices()
  } catch (error) {
    errorMessage.value = 'Data gagal dimuat.'
    console.error('Data dashboard belum dapat dimuat.', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <section class="dashboard-page" aria-labelledby="dashboard-title">
    <div class="dashboard-heading">
      <h1 id="dashboard-title">Dashboard</h1>
    </div>

    <!-- Controller menyusun fitur; masing-masing widget hanya menetapkan identitas visualnya. -->
    <div class="dashboard-grid">
      <DashboardCU v-bind="chartProps" @select-status="openStatusReport" />
      <DashboardDummy1 v-bind="chartProps" @select-status="openStatusReport" />
      <DashboardDummy2 v-bind="chartProps" @select-status="openStatusReport" />
      <DashboardDummy3 v-bind="chartProps" @select-status="openStatusReport" />
      <DashboardDummy4 v-bind="chartProps" @select-status="openStatusReport" />
      <DashboardDummy5 v-bind="chartProps" @select-status="openStatusReport" />
    </div>
  </section>
</template>

<style scoped>
/* Layout halaman dimiliki controller agar widget tidak mengatur posisi dirinya sendiri. */
.dashboard-page {
  width: 100%;
}

.dashboard-heading {
  margin-bottom: 1.25rem;
}

/* minmax(0, 1fr) mengisi lebar halaman dan mencegah isi panjang memaksa overflow kolom. */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 1.25rem;
}

@media (max-width: 900px) {
  /* Dua kolom menjaga chart tetap terbaca pada tablet dan jendela desktop yang sempit. */
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  /* Mobile memakai satu kolom sehingga tidak membutuhkan scroll horizontal halaman. */
  .dashboard-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
