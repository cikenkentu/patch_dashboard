<script setup>
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

// Layer kedua report: renderer reusable untuk toolbar, tabel, state, pagination, dan export.
// Arti field, sumber data, serta aturan filter tetap ditentukan oleh file domain pemanggil.
const props = defineProps({
  ariaLabel: { type: String, required: true },
  items: { type: Array, required: true },
  // sourceCount membedakan sumber kosong dari hasil kosong setelah filter diterapkan domain.
  sourceCount: { type: Number, required: true },
  // Metadata kolom adalah extension point; renderer tidak mengimpor schema domain mana pun.
  columns: { type: Array, required: true },
  statusOptions: { type: Array, default: () => [] },
  emptyTitle: { type: String, required: true },
  emptyDescription: { type: String, required: true },
  exportFilename: { type: String, required: true },
  isLoading: { type: Boolean, required: true },
  errorMessage: { type: String, default: '' },
  dataKey: { type: String, default: undefined },
  searchLabel: { type: String, default: 'Cari data' },
  searchPlaceholder: { type: String, default: 'Masukkan kata kunci' },
  statusFilterLabel: { type: String, default: 'Filter' },
  resetSearchLabel: { type: String, default: 'Reset pencarian' },
  exportLabel: { type: String, default: 'Export CSV' },
  // Fitur bersifat opt-in; setiap domain menyatakan kontrol yang benar-benar didukung.
  showSearch: { type: Boolean, default: false },
  showStatusFilter: { type: Boolean, default: false },
  showExport: { type: Boolean, default: false },
  showPagination: { type: Boolean, default: false },
})

// Nilai filter dimiliki domain dan ditulis balik melalui v-model; tabel hanya menyediakan kontrolnya.
const searchTerm = defineModel('searchTerm', { type: String, required: true })
const statusFilter = defineModel('statusFilter', { default: null })
// Offset dan ukuran halaman adalah state presentasi lokal, bukan bagian kontrak data domain.
const first = ref(0)
const pageSize = ref(20)
const dataTable = ref(null)

const numberFormatter = new Intl.NumberFormat('id-ID')
const formatNumber = (value) => numberFormatter.format(value)
const hasSearch = computed(() => props.showSearch && Boolean(searchTerm.value.trim()))
const hasResults = computed(() => props.items.length > 0)
const hasToolbar = computed(() => props.showSearch || props.showStatusFilter || props.showExport)
// `items` sudah merupakan hasil filter domain; export mencakup seluruh hasil itu, bukan halaman aktif.
const canExport = computed(() => props.showExport
  && !props.isLoading && !props.errorMessage && hasResults.value)
const pageReportLabel = computed(() => {
  if (!hasResults.value) return ''

  const pageFirst = first.value + 1
  const pageLast = Math.min(first.value + pageSize.value, props.items.length)
  return `Menampilkan ${formatNumber(pageFirst)}–${formatNumber(pageLast)} dari ${formatNumber(props.items.length)}`
})

function resetSearch() {
  searchTerm.value = ''
}

function formatColumnValue(column, row) {
  const value = row[column.field]
  return column.formatter ? column.formatter(value, row) : (value ?? '—')
}

function getColumnSeverity(column, row) {
  return column.severity ? column.severity(row[column.field], row) : undefined
}

function getColumnCellClass(column, row) {
  return typeof column.cellClass === 'function'
    ? column.cellClass(row[column.field], row)
    : column.cellClass
}

/**
 * Export memakai formatter kolom yang sama dengan layar agar representasi tetap konsisten.
 * Prefix apostrof adalah boundary keamanan terhadap formula injection saat CSV dibuka spreadsheet.
 */
function formatCsvCell({ data, field }) {
  const column = props.columns.find((item) => item.field === field)
  const value = column?.formatter ? column.formatter(data) : data
  const text = String(value ?? '')
  const safeText = /^[\t\r\n]/.test(text) || /^\s*[=+\-@]/.test(text) ? `'${text}` : text

  return safeText.replace(/"/g, '""')
}

function exportCsv() {
  if (canExport.value) dataTable.value?.exportCSV()
}

// Perubahan filter selalu kembali ke halaman pertama agar offset lama tidak menyembunyikan hasil.
watch([searchTerm, statusFilter], () => {
  first.value = 0
})
</script>

<template>
  <!-- ariaLabel menamai satu region report lengkap, termasuk toolbar dan tabelnya. -->
  <section class="report-content" :aria-label="ariaLabel">
      <div v-if="hasToolbar" class="report-toolbar">
        <label v-if="showSearch" class="filter-field filter-field--search">
          <span>{{ searchLabel }}</span>
          <InputText
            v-model="searchTerm"
            type="search"
            :placeholder="searchPlaceholder"
            :aria-label="searchLabel"
          />
        </label>

        <label v-if="showStatusFilter" class="filter-field">
          <span>{{ statusFilterLabel }}</span>
          <Select
            v-model="statusFilter"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            :aria-label="statusFilterLabel"
          />
        </label>

        <Button
          v-if="hasSearch"
          class="reset-search-button"
          :label="resetSearchLabel"
          severity="secondary"
          text
          @click="resetSearch"
        />

        <Button
          v-if="showExport"
          class="export-csv-button"
          :label="exportLabel"
          severity="secondary"
          outlined
          :disabled="!canExport"
          :aria-label="`${exportLabel} untuk seluruh hasil filter`"
          @click="exportCsv"
        />
      </div>

      <!-- Error memakai alert karena membutuhkan pengumuman segera; state jumlah memakai polite live-region. -->
      <div v-if="errorMessage" class="error-state" role="alert">
        {{ errorMessage }}
      </div>

      <div v-else class="data-table-wrapper">
        <!-- PrimeVue menangani sorting/pagination; domain hanya mengirim snapshot dan definisi kolom. -->
        <DataTable
          ref="dataTable"
          v-model:first="first"
          v-model:rows="pageSize"
          :value="items"
          :loading="isLoading"
          :data-key="dataKey"
          :paginator="showPagination && hasResults"
          :rows-per-page-options="[10, 20]"
          scrollable
          scroll-height="flex"
          paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          removable-sort
          striped-rows
          :export-filename="exportFilename"
          :export-function="formatCsvCell"
          :table-props="{ 'aria-label': ariaLabel }"
          table-style="width: 100%; table-layout: fixed"
          class="report-data-table"
          :class="{ 'report-data-table--empty': !isLoading && items.length === 0 }"
        >
          <template #paginatorend>
            <span class="localized-page-report" aria-live="polite">{{ pageReportLabel }}</span>
          </template>

          <Column
            v-for="column in columns"
            :key="column.field"
            :field="column.field"
            :header="column.subheader ? undefined : column.header"
            :export-header="column.exportHeader ?? column.header"
            :sortable="column.sortable !== false"
            :style="{ width: column.width }"
          >
            <template v-if="column.subheader" #header>
              <span class="time-header">
                {{ column.header }}
                <small>{{ column.subheader }}</small>
              </span>
            </template>

            <template #body="{ data }">
              <Tag
                v-if="column.type === 'status'"
                :value="formatColumnValue(column, data)"
                :severity="getColumnSeverity(column, data)"
                :class="getColumnCellClass(column, data)"
              />
              <time
                v-else-if="column.type === 'time'"
                :datetime="data[column.field] || undefined"
                :class="getColumnCellClass(column, data)"
              >
                {{ formatColumnValue(column, data) }}
              </time>
              <span v-else :class="getColumnCellClass(column, data)">
                {{ formatColumnValue(column, data) }}
              </span>
            </template>
          </Column>

          <!-- Copy empty-state berasal dari domain sehingga "tanpa data" dan "filter kosong" tetap akurat. -->
          <template #empty>
            <div class="table-empty-state">
              <strong>{{ emptyTitle }}</strong>
              <p>{{ emptyDescription }}</p>
              <Button
                v-if="hasSearch && sourceCount"
                :label="resetSearchLabel"
                severity="secondary"
                outlined
                @click="resetSearch"
              />
            </div>
          </template>
        </DataTable>
      </div>
  </section>
</template>

<style>
/* Tidak scoped karena selector berikut menata markup internal buatan PrimeVue. */
.report-content {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  border: 0;
  background: transparent;
}

.report-content .report-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  padding: 0 0 1rem;
}

.report-content .filter-field {
  display: grid;
  width: 230px;
  gap: 0.4rem;
}

.report-content .filter-field--search {
  width: min(360px, 100%);
}

.report-content .filter-field > span {
  color: #475467;
  font-size: 0.875rem;
  font-weight: 600;
}

.report-content .filter-field .p-inputtext,
.report-content .filter-field .p-select {
  width: 100%;
  border-radius: 3px;
}

.report-content .reset-search-button {
  margin-bottom: 0.05rem;
}

.report-content .export-csv-button {
  flex: 0 0 auto;
  margin-left: auto;
}

/* Tabel mengisi tinggi halaman; hanya area baris yang scroll ketika data panjang. */
.report-content .data-table-wrapper {
  display: flex;
  width: 100%;
  min-height: 20rem;
  flex: 1 1 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface);
}

.report-content .data-table-wrapper > .report-data-table.p-datatable {
  display: flex;
  min-width: 100%;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
}

.report-content .report-data-table .p-datatable-table-container {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
}

.report-content .report-data-table .p-datatable-thead > tr > th {
  padding: 0.9rem 1rem;
  border-color: var(--border-light);
  color: #344054;
  background: #f2f4f7;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
}

.report-content .report-data-table .p-datatable-column-header-content {
  gap: 0.4rem;
}

.report-content .report-data-table .p-datatable-tbody > tr > td {
  padding: 0.85rem 1rem;
  border-color: var(--border-light);
  color: #344054;
  font-size: 0.9375rem;
  line-height: 1.5;
  vertical-align: middle;
}

.report-content .report-data-table .p-datatable-tbody > tr:nth-child(even) {
  background: #fafbfc;
}

.report-content .report-data-table .p-paginator {
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-top: 1px solid var(--border);
  border-radius: 0;
}

.report-content .localized-page-report {
  color: var(--muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.report-content .report-data-table .p-tag {
  border-radius: 3px;
  white-space: nowrap;
}

.report-content .report-data-table time {
  display: block;
  white-space: normal;
  font-variant-numeric: tabular-nums;
}

.report-content .time-header {
  display: inline-flex;
  flex-direction: column;
  gap: 0.1rem;
}

.report-content .time-header small {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 500;
}

.report-content .table-empty-state {
  display: grid;
  max-width: 460px;
  margin: 0 auto;
  place-items: center;
  padding: 3.5rem 1.5rem;
  color: var(--muted);
  text-align: center;
}

.report-content .table-empty-state strong {
  margin-bottom: 0.35rem;
  color: var(--text);
}

.report-content .table-empty-state p {
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.report-content .report-data-table--empty .p-datatable-table-container {
  display: flex;
  flex-direction: column;
}

.report-content .report-data-table--empty .p-datatable-table {
  height: 100%;
  flex: 1 0 auto;
}

.report-content .report-data-table--empty .p-datatable-tbody,
.report-content .report-data-table--empty .p-datatable-tbody > tr,
.report-content .report-data-table--empty .p-datatable-tbody > tr > td {
  height: 100%;
}

.report-content .report-data-table--empty .p-datatable-tbody > tr > td {
  padding: 0;
}

.report-content .report-data-table--empty .table-empty-state {
  display: grid;
  height: 100%;
  min-height: 14rem;
  align-content: center;
  justify-items: center;
  padding: 2rem 1.5rem;
}

.report-content .error-state {
  padding: 2rem 1rem;
  color: #b42318;
  text-align: center;
}

@media (min-width: 901px) and (max-width: 1200px) {
  .report-content .report-data-table .p-datatable-thead > tr > th,
  .report-content .report-data-table .p-datatable-tbody > tr > td {
    padding-inline: 0.7rem;
  }
}

@media (max-width: 960px) {
  .report-content .report-data-table .p-datatable-table {
    min-width: 62rem;
  }
}

@media (max-width: 760px) {
  .report-content .report-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 0.75rem;
  }

  .report-content .filter-field,
  .report-content .filter-field--search {
    width: 100%;
  }

  .report-content .reset-search-button,
  .report-content .export-csv-button {
    align-self: flex-start;
  }

  .report-content .export-csv-button {
    margin-left: 0;
  }

  .report-content .report-data-table--empty .table-empty-state {
    position: sticky;
    left: 0;
    width: calc(100vw - 30px);
    max-width: none;
    min-height: 12rem;
    margin: 0;
  }
}
</style>
