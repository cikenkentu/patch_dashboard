// Entry point aplikasi: pasang router dan konfigurasi library UI sebelum Vue di-mount.
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

import App from './App.vue'

// Placeholder report tetap terpisah agar setiap card siap menerima schema domainnya sendiri.
const reportSlotRoutes = [
  { path: '/reports/slot-2', name: 'report-slot-2', component: () => import('./views/report/report_slot2.vue') },
  { path: '/reports/slot-3', name: 'report-slot-3', component: () => import('./views/report/report_slot3.vue') },
  { path: '/reports/slot-4', name: 'report-slot-4', component: () => import('./views/report/report_slot4.vue') },
  { path: '/reports/slot-5', name: 'report-slot-5', component: () => import('./views/report/report_slot5.vue') },
  { path: '/reports/slot-6', name: 'report-slot-6', component: () => import('./views/report/report_slot6.vue') },
]

// Route tetap di entry point agar daftar halaman dapat ditemukan tanpa menelusuri banyak file.
// Nama route adalah kontrak internal yang dipakai view untuk navigasi, jadi ubah dengan hati-hati.
const router = createRouter({
  // Clean URL membutuhkan fallback ke index.html pada web server ketika /reports dibuka langsung.
  history: createWebHistory(),
  // Lazy loading menjaga bundle DataTable report tidak ikut diunduh pada kunjungan awal dashboard.
  routes: [
    {
      path: '/',
      name: 'dashboard',
      // Halaman pusat menyusun domain dashboard aktif tanpa menduplikasi renderer.
      component: () => import('./views/dashboard/dashboard_view.vue'),
    },
    {
      path: '/reports',
      name: 'reports',
      // Report CU membaca filter status langsung dari query ?status=patched/unpatched.
      component: () => import('./views/report/report_cu.vue'),
    },
    ...reportSlotRoutes,
  ],
  // Setiap perpindahan halaman dimulai dari atas; query filter tidak menyimpan posisi scroll lama.
  scrollBehavior: () => ({ top: 0 }),
})

const app = createApp(App)

// Tema PrimeVue dipusatkan di sini supaya seluruh komponen memakai konfigurasi yang sama.
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: false,
      // CSS layer dimatikan karena report mengandalkan cascade biasa untuk override markup PrimeVue.
      cssLayer: false,
    },
  },
})

// Router harus aktif sebelum mount agar RouterLink/RouterView tersedia sejak render pertama.
app.use(router)
app.mount('#app')
