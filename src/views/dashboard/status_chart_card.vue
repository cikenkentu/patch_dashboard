<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'

// Komponen ini tidak melakukan fetch atau routing agar dapat dipakai ulang oleh semua kartu.
// statusItems harus berbentuk [{ value, label, color, count }]; urutannya menentukan mapping klik.
const props = defineProps({
  title: { type: String, required: true },
  chartType: { type: String, required: true },
  statusItems: { type: Array, required: true },
  total: { type: Number, required: true },
  hasData: { type: Boolean, required: true },
  isLoading: { type: Boolean, required: true },
  errorMessage: { type: String, default: '' },
})

// Parent menerima enum domain saja lalu memutuskan URL tujuan.
const emit = defineEmits(['select-status'])
const canvas = ref(null)
let chartInstance = null

// Chart.js menggambar teks langsung pada canvas, jadi font aplikasi harus ditetapkan eksplisit.
const APP_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
Chart.defaults.font.family = APP_FONT_FAMILY

// Satu formatter dipakai untuk angka visual, tooltip, dan teks aksesibel (contoh: 5.000).
const deviceCountFormatter = new Intl.NumberFormat('id-ID')
const formatDeviceCount = (value) => deviceCountFormatter.format(value)

const isStackedBar = computed(() => props.chartType === 'stackedBar')
// horizontalBar/stackedBar adalah alias milik UI; tipe native Chart.js untuk keduanya adalah bar.
const chartJsType = computed(() => (
  ['horizontalBar', 'stackedBar'].includes(props.chartType) ? 'bar' : props.chartType
))
const isCircularChart = computed(() => (
  ['doughnut', 'pie', 'polarArea'].includes(props.chartType)
))

// Teks aksesibel selalu berasal dari data yang sama dengan report.
const chartAriaLabel = computed(() => {
  if (props.isLoading) return `${props.title}: memuat data status patch perangkat.`
  if (props.errorMessage) return `${props.title}: data status patch gagal dimuat.`
  if (!props.hasData) return `${props.title}: data status patch belum tersedia.`

  const details = props.statusItems
    .map((status) => `${formatDeviceCount(status.count)} ${status.label.toLowerCase()}`)
    .join(' dan ')

  return `${props.title}: ${formatDeviceCount(props.total)} perangkat, ${details}.`
})

function getStatusActionLabel(status) {
  const action = `Buka report ${status.label.toLowerCase()}`
  if (props.isLoading) return `${action}, data sedang dimuat`
  if (props.errorMessage) return `${action}, data gagal dimuat`
  if (!props.hasData) return `${action}, data belum tersedia`
  return `${action}, ${formatDeviceCount(status.count)} perangkat`
}

function emptyStateText() {
  if (props.isLoading) return 'Memuat data'
  if (props.errorMessage) return 'Data gagal dimuat'
  return 'Data belum tersedia'
}

// Plugin per-instance boleh membaca props card ini tanpa membocorkan state ke instance chart lain.
// Satu plugin menangani angka tengah donut dan pesan kosong semua tipe chart.
const stateLabelPlugin = {
  id: 'dashboardStateLabel',
  afterDraw(chart) {
    const { ctx, chartArea } = chart
    if (!chartArea) return

    const x = (chartArea.left + chartArea.right) / 2
    const y = (chartArea.top + chartArea.bottom) / 2

    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (!props.hasData) {
      // Latar putih tipis menjaga pesan tetap terbaca di atas grid chart.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
      ctx.fillRect(x - 82, y - 20, 164, 40)
      ctx.fillStyle = '#667085'
      ctx.font = `600 13px ${APP_FONT_FAMILY}`
      ctx.fillText(emptyStateText(), x, y)
      ctx.restore()
      return
    }

    if (props.chartType === 'doughnut') {
      ctx.fillStyle = '#17202a'
      ctx.font = `700 32px ${APP_FONT_FAMILY}`
      ctx.fillText(formatDeviceCount(props.total), x, y - 8)
      ctx.fillStyle = '#667085'
      ctx.font = `600 11px ${APP_FONT_FAMILY}`
      ctx.fillText('PERANGKAT', x, y + 20)
    }

    ctx.restore()
  },
}

function buildChartData(chartHasData) {
  if (isStackedBar.value) {
    // Pada stacked bar, satu dataset mewakili satu status; tooltip dan klik memakai urutan ini.
    return {
      labels: ['Total perangkat'],
      datasets: props.statusItems.map((status) => ({
        label: status.label,
        data: [chartHasData ? status.count : 0],
        backgroundColor: chartHasData ? status.color : '#e4e7ec',
        borderWidth: 0,
      })),
    }
  }

  if (!chartHasData && isCircularChart.value) {
    // Chart lingkaran memerlukan nilai nonzero agar placeholder abu-abu tetap tergambar.
    // Klik tetap dinonaktifkan oleh chartHasData sehingga placeholder bukan data sungguhan.
    return {
      labels: ['Data belum tersedia'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e4e7ec'],
        borderColor: '#e4e7ec',
        borderWidth: 0,
      }],
    }
  }

  return {
    labels: props.statusItems.map((status) => status.label),
    datasets: [{
      label: 'Jumlah perangkat',
      data: props.statusItems.map((status) => chartHasData ? status.count : 0),
      backgroundColor: props.statusItems.map((status) => chartHasData ? status.color : '#e4e7ec'),
      borderColor: props.statusItems.map((status) => chartHasData ? status.color : '#d0d5dd'),
      borderWidth: props.chartType === 'line' ? 2 : 0,
      hoverOffset: chartHasData && isCircularChart.value ? 5 : 0,
      tension: 0.25,
      fill: false,
    }],
  }
}

function buildScales() {
  // Chart lingkaran tidak memiliki sumbu; mengirim scales hanya menambah konfigurasi yang tidak perlu.
  if (isCircularChart.value) return undefined

  const isHorizontal = ['horizontalBar', 'stackedBar'].includes(props.chartType)
  // Callback hanya dipasang pada sumbu angka; sumbu kategori tetap memakai label status.
  const countTicks = {
    precision: 0,
    callback: (value) => formatDeviceCount(value),
  }
  const valueScale = {
    beginAtZero: true,
    stacked: isStackedBar.value,
    grid: { display: true },
    ticks: countTicks,
  }
  const categoryScale = {
    stacked: isStackedBar.value,
    grid: { display: false },
  }

  // Jangan kirim ticks callback ke sumbu kategori; Chart.js harus menampilkan label statusnya.
  return isHorizontal
    ? { x: valueScale, y: categoryScale }
    : { x: categoryScale, y: valueScale }
}

function statusFromElement(element) {
  // Stacked bar memakai datasetIndex; semua tipe lain memetakan status melalui data index.
  // Jaga aturan ini sinkron dengan buildChartData dan callback tooltip.
  const statusIndex = isStackedBar.value ? element.datasetIndex : element.index
  return props.statusItems[statusIndex]
}

function renderChart() {
  if (!canvas.value) return

  const chartHasData = props.hasData
  // Chart.js hanya boleh memiliki satu instance per canvas; destroy mencegah listener menumpuk.
  chartInstance?.destroy()

  chartInstance = new Chart(canvas.value, {
    type: chartJsType.value,
    data: buildChartData(chartHasData),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Chart.js memakai locale ini untuk angka internal yang tidak memakai callback sendiri.
      locale: 'id-ID',
      cutout: props.chartType === 'doughnut' ? '72%' : undefined,
      indexAxis: ['horizontalBar', 'stackedBar'].includes(props.chartType) ? 'y' : 'x',
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
      scales: buildScales(),
      onHover(_event, elements) {
        // Pointer hanya muncul di elemen data nyata; status row tetap menjadi jalur keyboard.
        canvas.value.style.cursor = chartHasData && elements.length ? 'pointer' : 'default'
      },
      onClick(_event, elements) {
        // Abaikan klik area kosong/placeholder sebelum meneruskan status ke parent.
        if (!chartHasData || !elements.length) return
        const status = statusFromElement(elements[0])
        if (status) emit('select-status', status.value)
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: chartHasData,
          callbacks: {
            label(context) {
              const status = isStackedBar.value
                ? props.statusItems[context.datasetIndex]
                : props.statusItems[context.dataIndex]
              return status
                ? ` ${status.label}: ${formatDeviceCount(status.count)} perangkat`
                : ''
            },
          },
        },
      },
    },
    plugins: [stateLabelPlugin],
  })
}

onMounted(renderChart)

// Dependency eksplisit menghindari deep-watch object props, namun tetap merender perubahan API penting.
watch(
  () => [
    props.chartType,
    props.total,
    props.hasData,
    props.isLoading,
    props.errorMessage,
    ...props.statusItems.map((status) => status.count),
  ],
  renderChart,
  { flush: 'post' },
)

// Lepaskan listener dan resource canvas ketika route/card dilepas.
onBeforeUnmount(() => chartInstance?.destroy())
</script>

<template>
  <article class="status-overview">
    <h2>{{ title }}</h2>

    <div class="status-overview__content">
      <!-- Klik canvas adalah shortcut pointer; tombol status di bawah tetap aksesibel via keyboard. -->
      <div class="status-chart">
        <canvas ref="canvas" role="img" :aria-label="chartAriaLabel"></canvas>
      </div>

      <!-- Seluruh baris status dapat diklik menuju report terfilter. -->
      <div class="status-list" role="group" :aria-label="`Buka report dari ${title}`">
        <button
          v-for="status in statusItems"
          :key="status.value"
          type="button"
          :aria-label="getStatusActionLabel(status)"
          @click="emit('select-status', status.value)"
        >
          <span class="status-list__label">
            <span class="status-dot" :style="{ backgroundColor: status.color }" aria-hidden="true"></span>
            {{ status.label }}
          </span>
          <strong>{{ hasData ? formatDeviceCount(status.count) : '—' }}</strong>
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* Semua kartu memakai rasio dan struktur yang sama agar grid tetap sejajar antarjenis chart. */
.status-overview {
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 1.25rem;
  border: 1px solid var(--border);
  background: var(--surface);
}

.status-overview > h2 {
  overflow: hidden;
  font-size: 1rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-overview__content {
  /* min-height: 0 mengizinkan canvas menyusut di dalam nested grid tanpa overflow. */
  display: grid;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.75rem;
  padding-top: 0.75rem;
}

.status-chart {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.status-list {
  width: 100%;
  border-top: 1px solid var(--border-light);
}

.status-list button {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0.5rem;
  border: 0;
  border-bottom: 1px solid var(--border-light);
  color: var(--text);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.status-list button:hover,
.status-list button:focus-visible {
  background: #f2f4f7;
}

.status-list button:focus-visible {
  outline: 2px solid var(--link);
  outline-offset: -2px;
}

.status-list__label {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-list strong {
  color: var(--text);
  font-size: 1.5rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.status-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
}

@media (max-width: 760px) {
  .status-overview {
    padding: 1.1rem;
  }
}

@media (max-width: 430px) {
  .status-overview {
    /* Lepaskan bentuk persegi saat lebar mobile terlalu kecil untuk chart dan dua tombol status. */
    aspect-ratio: auto;
  }

  .status-overview__content {
    grid-template-rows: auto auto;
  }

  .status-chart {
    height: 210px;
  }
}
</style>
