// Konfigurasi build sengaja kecil: Vue plugin dan artifact kepatuhan dependency.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { handleApiRequest } from './backend/server.js'

// Development dan preview memakai handler backend yang sama tanpa proses/dependency tambahan.
function internalApi() {
  const attach = (server) => {
    server.middlewares.use((request, response, next) => {
      handleApiRequest(request, response, next).catch(next)
    })
  }

  return {
    name: 'internal-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

export default defineConfig({
  plugins: [vue(), internalApi()],
  build: {
    // Notice membantu review artifact; package-lock.json tetap inventaris dependency otoritatif.
    license: { fileName: 'THIRD_PARTY_LICENSES.txt' },
  },
})
