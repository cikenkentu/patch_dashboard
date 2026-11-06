import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// API bersifat read-only. Credential BigFix tidak boleh diteruskan ke browser.
// Semua response API memakai JSON agar kontraknya mudah dipakai frontend dan backend lain.
const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    ...JSON_HEADERS,
    ...extraHeaders,
    'Content-Length': Buffer.byteLength(body),
  })
  response.end(body)
}

/**
 * Titik integrasi data perangkat.
 * Ganti isi fungsi ini dengan pemanggilan service/database internal yang sudah menormalisasi BigFix.
 * Array kosong sengaja dipakai sampai provider nyata tersedia; tidak ada fallback data buatan.
 */
async function loadDevices() {
  return []
}

/**
 * Handler yang sama dipakai Vite saat development dan server Node saat deployment.
 * `next` hanya tersedia pada middleware Vite agar request asset/frontend dapat diteruskan.
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

  if (pathname === '/api/devices') {
    try {
      const devices = await loadDevices()
      if (!Array.isArray(devices)) throw new TypeError('Device provider harus mengembalikan array.')

      return sendJson(response, 200, devices)
    } catch (error) {
      // Detail internal hanya dicatat di server; browser menerima pesan aman tanpa stack/credential.
      console.error('Gagal memuat data perangkat:', error)
      return sendJson(response, 502, { message: 'Data perangkat belum dapat dimuat.' })
    }
  }

  return sendJson(response, 404, { message: 'Endpoint tidak ditemukan.' })
}

function startServer() {
  const host = process.env.PATCHING_API_HOST?.trim() || '127.0.0.1'
  const port = Number(process.env.PATCHING_API_PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError('PATCHING_API_PORT harus berupa angka antara 1 dan 65535.')
  }

  const server = createServer((request, response) => {
    handleApiRequest(request, response).catch((error) => {
      console.error('Request API gagal:', error)
      if (!response.headersSent) sendJson(response, 500, { message: 'Terjadi kesalahan pada server.' })
      else response.end()
    })
  })

  // Default loopback aman untuk reverse proxy lokal; ubah host hanya melalui konfigurasi deployment.
  server.listen(port, host, () => {
    console.log(`Backend API berjalan di http://${host}:${port}`)
  })
}

// Import dari Vite tidak membuka port; server hanya start ketika file dijalankan langsung.
const entryFile = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entryFile) startServer()
