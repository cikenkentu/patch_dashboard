<script setup>
import ReportLayout from '../../../shared/report/report_layout.vue'
import ReportTable from '../../../shared/report/report_table.vue'

// Placeholder menjaga pasangan satu route : satu dashboard tanpa membawa mock data.
// Saat domain 5 tersedia, pertahankan dua layer reusable ini lalu tambahkan config/state khusus domain di sini.
const REPORT = Object.freeze({ title: 'Report Dashboard 5', titleId: 'report-slot-5-title' })
// Kontrak kosong eksplisit membuat renderer dapat digunakan sebelum schema dan endpoint ditentukan.
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
      export-filename="report-dashboard-5"
      :is-loading="false"
    />
  </ReportLayout>
</template>
