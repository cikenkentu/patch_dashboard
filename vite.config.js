// Konfigurasi build sengaja kecil: Vue plugin dan artifact kepatuhan dependency.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    // Notice membantu review artifact; package-lock.json tetap inventaris dependency otoritatif.
    license: { fileName: 'THIRD_PARTY_LICENSES.txt' },
  },
})
