<script setup>
import { useRouter } from 'vue-router'

import DashboardCard from './dashboard_card.vue'
import DashboardChart from './dashboard_chart.vue'

/**
 * Slot domain mandiri untuk dashboard berikutnya. Saat endpoint tersedia, tambahkan service,
 * state loading/error, mapping items, dan route report di file ini; reuse Card dan Chart tanpa
 * memasukkan aturan bisnis slot 5 ke komponen umum.
 */
const DASHBOARD = Object.freeze({ title: 'Dashboard 5', reportPath: '/reports/slot-5' })
// Empty state eksplisit: belum ada payload, bukan hasil pengukuran bernilai nol.
const EMPTY_ITEMS = Object.freeze([])
const router = useRouter()

// Renderer hanya mengirim intent; slot domain tetap menjadi pemilik navigasi.
function openReport() {
  router.push(DASHBOARD.reportPath)
}
</script>

<template>
  <!-- Placeholder mempertahankan ukuran/layout final tanpa menyuntikkan data dummy. -->
  <DashboardCard :title="DASHBOARD.title">
    <DashboardChart
      :title="DASHBOARD.title"
      chart-type="doughnut"
      :items="EMPTY_ITEMS"
      :total="0"
      :has-data="false"
      :is-loading="false"
      allow-empty-selection
      @select-empty="openReport"
    />
  </DashboardCard>
</template>
