<script setup>
import StatusChartCard from './status_chart_card.vue'

// Wrapper hanya menetapkan identitas chart; data, loading, dan event datang dari controller.
// Nonaktifkan inheritAttrs agar $attrs diteruskan tepat sekali ke StatusChartCard.
defineOptions({ inheritAttrs: false })
</script>

<template>
  <StatusChartCard v-bind="$attrs" title="Dashboard Dummy 4 — Polar Area" chart-type="polarArea" />
</template>
