<script setup>
import ReportLayout from './report_layout.vue'
import ReportTable from './report_table.vue'

const REPORT = Object.freeze({ title: 'Report Dashboard 3', titleId: 'report-slot-3-title' })
const EMPTY_ITEMS = Object.freeze([])
const EMPTY_COLUMNS = Object.freeze([])
</script>

<template>
  <ReportLayout
    :title="REPORT.title"
    :title-id="REPORT.titleId"
    description="Endpoint dan schema report belum dikonfigurasi."
  >
    <ReportTable
      search-term=""
      :status-filter="null"
      :aria-label="REPORT.title"
      :items="EMPTY_ITEMS"
      :source-count="0"
      :columns="EMPTY_COLUMNS"
      empty-title="Data belum tersedia"
      empty-description="Data akan tampil setelah endpoint domain terhubung."
      export-filename="report-dashboard-3"
      :is-loading="false"
    />
  </ReportLayout>
</template>
