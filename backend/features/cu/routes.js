import { loadCuDashboard } from './dashboard/cuDashboard.js'
import { loadCuReport } from './report/cuReport.js'

// Seluruh identitas HTTP milik CU berada di feature ini. Server hanya menjalankan registry umum.
// Feature patch berikutnya dapat mengekspor registry serupa tanpa memindahkan mapping ke shared.
export const cuDataRoutes = Object.freeze([
  Object.freeze({
    path: '/api/dashboard/cu',
    loader: loadCuDashboard,
    logLabel: 'dashboard-cu',
    publicMessage: 'Ringkasan CU belum dapat dimuat.',
  }),
  Object.freeze({
    path: '/api/report/cu',
    loader: loadCuReport,
    logLabel: 'report-cu',
    publicMessage: 'Data report CU belum dapat dimuat.',
  }),
])
