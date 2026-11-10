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
// Persentase sudah dihitung dan divalidasi backend; view hanya memformat nilai canonical tersebut.
const progressPercent = computed(() => summary.value?.progressPercent ?? null)
const progressText = computed(() => (
  progressPercent.value == null ? '—' : `${percentageFormatter.format(progressPercent.value)}%`
))
const progressAriaText = computed(() => {
  if (isLoading.value) return 'Progress patch sedang dimuat.'
  if (errorMessage.value) return 'Progress patch tidak dapat dimuat.'
  if (progressPercent.value == null) return 'Progress patch belum tersedia.'
  return `${percentageFormatter.format(progressPercent.value)} persen perangkat sudah di-patch.`
})

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

// Report belum memiliki patchStatus per perangkat, jadi semua interaksi membuka tabel tanpa filter.
// Query status dapat diaktifkan kembali ketika adapter report sudah menerima field tersebut.
function openReport() {
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
  >
    <DashboardChart
      :title="CU_DASHBOARD.title"
      :chart-type="CU_DASHBOARD.chartType"
      :value-unit="CU_DASHBOARD.valueUnit"
      :items="items"
      :total="total"
      :has-data="hasData"
      :is-loading="isLoading"
      :error-message="errorMessage"
      :interactive="CU_DASHBOARD.interactive"
      allow-empty-selection
      @select-item="openReport"
      @select-empty="openReport"
    />

    <!-- Detail khusus CU memakai extension point card; domain lain bebas memakai isi berbeda. -->
    <template #details>
      <div class="cu-progress">
        <div class="cu-progress__header">
          <span>Progress patch</span>
          <strong>{{ progressText }}</strong>
        </div>
        <div
          class="cu-progress__track"
          :class="{ 'is-unavailable': progressPercent == null }"
          role="progressbar"
          aria-label="Progress patch CU"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progressPercent ?? undefined"
          :aria-valuetext="progressAriaText"
          :aria-busy="isLoading"
        >
          <span
            class="cu-progress__fill"
            :style="{ width: `${progressPercent ?? 0}%` }"
            aria-hidden="true"
          ></span>
        </div>
        <RouterLink class="cu-progress__report-link" :to="CU_DASHBOARD.reportPath">
          Lihat report CU
          <span aria-hidden="true">→</span>
        </RouterLink>
      </div>
    </template>
  </DashboardCard>
</template>

<style scoped>
.cu-progress {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 0.55rem;
  padding: 0.75rem 0.25rem 0.15rem;
}

.cu-progress__header {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 600;
}

.cu-progress__header strong {
  flex: 0 0 auto;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.cu-progress__track {
  width: 100%;
  height: 0.6rem;
  overflow: hidden;
  border-radius: 999px;
  background: #8c2f45;
}

.cu-progress__track.is-unavailable {
  background: #e4e7ec;
}

.cu-progress__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2f6b4f;
  transition: width 240ms ease;
}

.cu-progress__report-link {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  justify-self: end;
  gap: 0.35rem;
  color: var(--link);
  font-size: 0.8125rem;
  font-weight: 650;
  text-decoration: none;
}

.cu-progress__report-link:hover {
  text-decoration: underline;
}

.cu-progress__report-link:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--link);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .cu-progress__fill {
    transition: none;
  }
}

@media (max-width: 430px) {
  .cu-progress__header {
    align-items: baseline;
  }

  .cu-progress__report-link {
    min-height: 2.75rem;
  }
}
</style>
