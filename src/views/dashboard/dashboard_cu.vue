<script setup>
import StatusChartCard from './status_chart_card.vue'

// Adapter fitur CU hanya menetapkan identitas chart; controller menyediakan data dan navigasi.
// inheritAttrs dimatikan agar props serta listener diteruskan tepat sekali ke komponen visual.
defineOptions({ inheritAttrs: false })
</script>

<template>
  <!-- $attrs berisi kontrak chartProps dan listener select-status dari dashboard_view. -->
  <StatusChartCard v-bind="$attrs" title="CU Patch" chart-type="doughnut" />
</template>
