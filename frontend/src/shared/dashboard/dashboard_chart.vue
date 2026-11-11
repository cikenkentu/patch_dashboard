<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'

// Registry ini adalah satu-satunya tempat pemetaan nama chart aplikasi ke konfigurasi Chart.js.
// Dashboard baru cukup memilih key; aturan domain tidak boleh ditambahkan ke renderer umum ini.
const CHART_TYPES = Object.freeze({
  doughnut: { chartJsType: 'doughnut', circular: true, cutout: '72%' },
  pie: { chartJsType: 'pie', circular: true },
  polarArea: { chartJsType: 'polarArea', circular: true },
  bar: { chartJsType: 'bar', circular: false },
  horizontalBar: { chartJsType: 'bar', circular: false, indexAxis: 'y' },
  line: { chartJsType: 'line', circular: false },
})

/**
 * Renderer canvas reusable dengan kontrak item { key, label, value, color }.
 * Komponen ini tidak melakukan fetch dan tidak mengetahui URL report. Ia hanya menggambar state
 * yang diberikan parent serta mengirim event select-item/select-empty sebagai intent semantik.
 * Judul dipakai untuk aksesibilitas; heading visual tetap dimiliki DashboardCard.
 */
const props = defineProps({
  title: { type: String, required: true },
  chartType: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  hasData: { type: Boolean, required: true },
  isLoading: { type: Boolean, required: true },
  errorMessage: { type: String, default: '' },
  valueUnit: { type: String, default: '' },
  centerDetail: { type: String, default: '' },
  interactive: { type: Boolean, default: true },
  // Domain boleh membuka report kosong tanpa membuat renderer mengetahui URL tujuan.
  allowEmptySelection: { type: Boolean, default: false },
})

const emit = defineEmits(['select-item', 'select-empty'])
const canvas = ref(null)
let chartInstance = null

const APP_FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const numberFormatter = new Intl.NumberFormat('id-ID')
const formatValue = (value) => numberFormatter.format(value)
const chartDefinition = computed(() => {
  const definition = CHART_TYPES[props.chartType]
  if (!definition) throw new TypeError(`Chart type "${props.chartType}" belum didukung template.`)
  return definition
})

// Invariant state: loading menggambarkan request aktif, errorMessage kegagalan terakhir, dan
// hasData hanya true setelah parent memiliki payload canonical. Nilai total 0 tetap data valid,
// tetapi sengaja tidak interaktif karena tidak ada segmen report yang dapat dipilih.
const canSelect = computed(() => (
  props.interactive && props.hasData && props.total > 0 && !props.isLoading && !props.errorMessage
))
const canSelectEmpty = computed(() => (
  props.interactive
  && props.allowEmptySelection
  && !props.hasData
  && !props.isLoading
))
const valueSuffix = computed(() => (props.valueUnit ? ` ${props.valueUnit}` : ''))

// Chart.js menggambar font pada canvas, sehingga font aplikasi perlu ditetapkan eksplisit.
Chart.defaults.font.family = APP_FONT_FAMILY

const chartAriaLabel = computed(() => {
  if (props.isLoading) return `${props.title}: memuat data chart.`
  if (props.errorMessage) {
    const actionHint = canSelectEmpty.value ? ' Aktifkan untuk membuka report kosong.' : ''
    return `${props.title}: data chart gagal dimuat.${actionHint}`
  }
  if (!props.hasData) {
    const actionHint = canSelectEmpty.value ? ' Aktifkan untuk membuka report kosong.' : ''
    return `${props.title}: data chart belum tersedia.${actionHint}`
  }

  const details = props.items
    .map((item) => `${formatValue(item.value)} ${item.label.toLowerCase()}`)
    .join(' dan ')
  const centerDetail = props.centerDetail.trim() ? `, ${props.centerDetail.trim()}` : ''
  return `${props.title}: total ${formatValue(props.total)}${valueSuffix.value}, ${details}${centerDetail}.`
})

function emptyStateText() {
  if (props.isLoading) return 'Memuat data'
  if (props.errorMessage) return 'Data gagal dimuat'
  return 'Data belum tersedia'
}

function selectEmptyChart() {
  if (canSelectEmpty.value) emit('select-empty')
}

// Plugin tunggal menyamakan empty/loading/error dan label pusat tanpa membocorkan detail domain.
const centerLabelPlugin = {
  id: 'dashboardCenterLabel',
  afterDraw(chart) {
    const { ctx, chartArea } = chart
    if (!chartArea) return

    const x = (chartArea.left + chartArea.right) / 2
    const y = (chartArea.top + chartArea.bottom) / 2
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (!props.hasData) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
      ctx.fillRect(x - 82, y - 20, 164, 40)
      ctx.fillStyle = '#667085'
      ctx.font = `600 13px ${APP_FONT_FAMILY}`
      ctx.fillText(emptyStateText(), x, y)
    } else if (props.chartType === 'doughnut') {
      const hasCenterDetail = Boolean(props.centerDetail.trim())
      ctx.fillStyle = '#17202a'
      ctx.font = `700 32px ${APP_FONT_FAMILY}`
      ctx.fillText(formatValue(props.total), x, y - (hasCenterDetail ? 15 : 8))
      ctx.fillStyle = '#667085'
      ctx.font = `600 11px ${APP_FONT_FAMILY}`
      ctx.fillText(props.valueUnit ? props.valueUnit.toUpperCase() : 'TOTAL', x, y + (hasCenterDetail ? 11 : 20))

      if (hasCenterDetail) {
        ctx.fillStyle = '#475467'
        ctx.font = `700 12px ${APP_FONT_FAMILY}`
        ctx.fillText(props.centerDetail.trim(), x, y + 34)
      }
    }

    ctx.restore()
  },
}

function buildChartData() {
  // Chart lingkaran memerlukan nilai nonzero agar placeholder abu-abu tetap tergambar.
  if ((!props.hasData || props.total === 0) && chartDefinition.value.circular) {
    return {
      labels: ['Data belum tersedia'],
      datasets: [{ data: [1], backgroundColor: ['#e4e7ec'], borderWidth: 0 }],
    }
  }

  const colors = props.items.map((item) => (props.hasData ? item.color : '#e4e7ec'))
  const separatesCircularSegments = props.hasData && chartDefinition.value.circular
  return {
    labels: props.items.map((item) => item.label),
    datasets: [{
      label: props.valueUnit ? `Jumlah ${props.valueUnit}` : 'Nilai',
      data: props.items.map((item) => (props.hasData ? item.value : 0)),
      backgroundColor: colors,
      borderColor: props.chartType === 'line'
        ? (colors[0] ?? '#667085')
        : (separatesCircularSegments ? '#ffffff' : colors),
      pointBackgroundColor: colors,
      borderWidth: props.chartType === 'line' || separatesCircularSegments ? 2 : 0,
      hoverOffset: props.hasData && chartDefinition.value.circular ? 5 : 0,
      tension: 0.25,
      fill: false,
    }],
  }
}

function buildScales() {
  if (chartDefinition.value.circular) return undefined

  const valueScale = {
    beginAtZero: true,
    grid: { display: true },
    ticks: { precision: 0, callback: (value) => formatValue(value) },
  }
  const categoryScale = { grid: { display: false } }

  return chartDefinition.value.indexAxis === 'y'
    ? { x: valueScale, y: categoryScale }
    : { x: categoryScale, y: valueScale }
}

function destroyChart() {
  chartInstance?.destroy()
  chartInstance = null
}

// Instance selalu dihancurkan sebelum render ulang agar canvas tidak menyimpan listener/dataset lama.
function renderChart() {
  if (!canvas.value) return
  destroyChart()

  chartInstance = new Chart(canvas.value, {
    type: chartDefinition.value.chartJsType,
    data: buildChartData(),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      locale: 'id-ID',
      cutout: chartDefinition.value.cutout,
      indexAxis: chartDefinition.value.indexAxis,
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
      scales: buildScales(),
      onHover(_event, elements) {
        const canOpen = canSelectEmpty.value || (canSelect.value && elements.length)
        canvas.value.style.cursor = canOpen ? 'pointer' : 'default'
      },
      onClick(_event, elements) {
        // Renderer mengirim key item saja; validasi route dan navigasi tetap berada di parent domain.
        if (canSelectEmpty.value) {
          emit('select-empty')
          return
        }
        if (!canSelect.value || !elements.length) return
        const item = props.items[elements[0].index]
        if (item) emit('select-item', item.key)
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: props.hasData && props.total > 0,
          callbacks: {
            label(context) {
              const item = props.items[context.dataIndex]
              return item ? ` ${item.label}: ${formatValue(item.value)}${valueSuffix.value}` : ''
            },
          },
        },
      },
    },
    plugins: [centerLabelPlugin],
  })
}

onMounted(renderChart)

// Watch eksplisit menjaga render deterministik dan menghindari deep-watch terhadap object domain.
watch(
  () => [
    props.chartType,
    props.total,
    props.hasData,
    props.isLoading,
    props.errorMessage,
    props.centerDetail,
    props.interactive,
    props.allowEmptySelection,
    props.valueUnit,
    ...props.items.flatMap((item) => [item.key, item.label, item.value, item.color]),
  ],
  renderChart,
  { flush: 'post' },
)

onBeforeUnmount(destroyChart)
</script>

<template>
  <div
    class="dashboard-chart"
    :class="{ 'dashboard-chart--circular': chartDefinition.circular }"
  >
    <canvas
      ref="canvas"
      :role="canSelectEmpty ? 'button' : 'img'"
      :tabindex="canSelectEmpty ? 0 : undefined"
      :aria-label="chartAriaLabel"
      :class="{ 'is-empty-selectable': canSelectEmpty }"
      @keydown.enter.prevent="selectEmptyChart"
      @keydown.space.prevent="selectEmptyChart"
    ></canvas>
  </div>
</template>

<style scoped>
.dashboard-chart {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Diameter dibatasi agar chart antarkartu konsisten; wrapper tetap menyusut mengikuti lebar kolom. */
.dashboard-chart--circular {
  max-width: 16.25rem;
  max-height: 16.25rem;
  margin: auto;
}

.dashboard-chart canvas {
  display: block;
  max-width: 100% !important;
  max-height: 100% !important;
}

.dashboard-chart canvas.is-empty-selectable {
  cursor: pointer;
}

.dashboard-chart canvas:focus-visible {
  outline: 2px solid var(--link);
  outline-offset: -2px;
}
</style>
