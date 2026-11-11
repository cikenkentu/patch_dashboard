import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { dataRoutes } from './features/routes.js'
import { JsonSourceError } from './shared/jsonSourceClient.js'

// Lapisan ini hanya memiliki transport HTTP/routing; fetch dan transformasi vendor tetap di adapter.
// API bersifat read-only dan semua response memakai JSON tanpa meneruskan credential ke browser.
const JSON_HEADERS = {
  // Data patch dapat berubah di sumber; cache baru boleh ditambahkan setelah kebijakan freshness jelas.
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

// Route registry menjaga server tetap tipis saat domain dashboard/report berikutnya ditambahkan.
// Loader adalah satu-satunya bagian yang berbeda; kebijakan error dan respons tetap konsisten.
const DATA_ROUTES = dataRoutes

/** Satu serializer menjaga header keamanan dan Content-Length konsisten pada seluruh route API. */
function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    ...JSON_HEADERS,
    ...extraHeaders,
    'Content-Length': Buffer.byteLength(body),
  })
  response.end(body)
}

/** Menjalankan adapter domain tanpa membocorkan URL, body vendor, cause, atau credential ke log/API. */
async function serveDataRoute(response, route) {
  try {
    return sendJson(response, 200, await route.loader())
  } catch (error) {
    const isKnownError = error instanceof JsonSourceError
    const code = isKnownError ? error.code : 'UPSTREAM_UNAVAILABLE'
    const statusCode = isKnownError ? error.statusCode : 502

    // Hanya identitas route dan kode terklasifikasi yang dicatat; raw Error dapat membawa URL/cause.
    console.error('Gagal memuat data upstream.', { route: route.logLabel, code })
    return sendJson(response, statusCode, { code, message: route.publicMessage })
  }
}

/**
 * Router API yang sama dipakai middleware Vite dan server Node produksi.
 * Hanya request `/api/*` dimiliki fungsi ini; `next` meneruskan asset/SPA ke Vite ketika tersedia.
 * Route bertanggung jawab atas status dan pesan publik, sedangkan adapter bertanggung jawab atas
 * akses sumber, autentikasi, validasi, dan normalisasi.
 */
export async function handleApiRequest(request, response, next) {
  const pathname = new URL(request.url ?? '/', 'http://internal.local').pathname

  if (!pathname.startsWith('/api/')) {
    if (next) return next()
    return sendJson(response, 404, { message: 'Endpoint tidak ditemukan.' })
  }

  if (request.method !== 'GET') {
    return sendJson(response, 405, { message: 'Method tidak didukung.' }, { Allow: 'GET' })
  }

  if (pathname === '/api/health') {
    return sendJson(response, 200, { status: 'ok' })
  }

  const dataRoute = DATA_ROUTES.get(pathname)
  if (dataRoute) return serveDataRoute(response, dataRoute)

  return sendJson(response, 404, { message: 'Endpoint tidak ditemukan.' })
}

function startServer() {
  // Binding adalah konfigurasi deployment; loopback tetap default aman di belakang reverse proxy.
  const host = process.env.PATCHING_API_HOST?.trim() || '127.0.0.1'
  const port = Number(process.env.PATCHING_API_PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('PATCHING_API_PORT harus berupa angka antara 1 dan 65535.')
  }

  const server = createServer((request, response) => {
    // Guard terakhir menangani bug route tanpa menimpa response yang sudah mulai dikirim.
    handleApiRequest(request, response).catch(() => {
      console.error('Request API gagal.', { code: 'INTERNAL_ERROR' })
      if (!response.headersSent) sendJson(response, 500, { message: 'Terjadi kesalahan pada server.' })
      else response.end()
    })
  })

  server.listen(port, host, () => {
    console.log(`Backend API berjalan di http://${host}:${port}`)
  })
}

// Entry guard menjaga import dari vite.config.js bebas side effect berupa port tambahan.
const entryFile = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entryFile) startServer()
