// Entry point aplikasi: pasang router dan konfigurasi library UI sebelum Vue di-mount.
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'

import App from './App.vue'

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
      // Route menunjuk controller halaman; widget CU tidak menangani lifecycle route.
      component: () => import('./views/dashboard/dashboard_view.vue'),
    },
    {
      path: '/reports',
      name: 'reports',
      // Filter status report dibaca dari query ?status=patched/unpatched.
      component: () => import('./views/report/report_cu.vue'),
    },
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
