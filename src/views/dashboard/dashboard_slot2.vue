<script setup>
import { useRouter } from 'vue-router'

import DashboardCard from './dashboard_card.vue'
import DashboardChart from './dashboard_chart.vue'

// Placeholder visual saja; file ini menjadi domain nyata setelah endpoint tersedia.
const DASHBOARD = Object.freeze({ title: 'Dashboard 2', reportPath: '/reports/slot-2' })
const EMPTY_ITEMS = Object.freeze([])
const router = useRouter()

function openReport() {
  router.push(DASHBOARD.reportPath)
}
</script>

<template>
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
