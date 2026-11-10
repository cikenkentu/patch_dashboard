// File ini hanya merangkai tooling: kontrak API dan business mapping tetap berada di backend/src.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { handleApiRequest } from './backend/server.js'

/**
 * Adapter pengembangan yang memasang handler produksi ke middleware Vite.
 * Request non-API diteruskan melalui `next`, sehingga plugin ini tidak mengambil alih asset atau SPA.
 * Environment/credential tetap dibaca backend saat request dan tidak dimasukkan ke bundle browser.
 * Deployment produksi menjalankan backend/server.js di belakang reverse proxy, bukan plugin ini.
 */
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
    // Notice ikut artifact; package-lock.json tetap sumber inventaris dependency yang otoritatif.
    license: { fileName: 'THIRD_PARTY_LICENSES.txt' },
  },
})
