import { isIP } from 'node:net'

import { fetchJsonSource, invalidSourcePayload } from '../../../shared/jsonSourceClient.js'

const REPORT_SOURCE_URL_ENV = 'PATCHING_CU_REPORT_SOURCE_URL'
const SOURCE_USERNAME_ENV = 'PATCHING_CU_SOURCE_USERNAME'
const SOURCE_PASSWORD_ENV = 'PATCHING_CU_SOURCE_PASSWORD'
const MAX_REPORT_ROWS = 100_000
const MAX_REPORT_RESPONSE_BYTES = 64 * 1024 * 1024
const MAX_TEXT_LENGTH = Object.freeze({
  hostname: 255,
  ipAddresses: 2_048,
  osVersion: 512,
  processor: 512,
  lastReportTime: 128,
})
const EXPLICIT_TIMEZONE_PATTERN = /(?:Z|[+-]\d{2}:?\d{2}|UTC|GMT)$/i

function readRequiredText(value, fieldName, rowIndex) {
  if (typeof value !== 'string') {
    throw invalidSourcePayload(`${fieldName} row ${rowIndex} wajib berupa string.`)
  }

  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_TEXT_LENGTH[fieldName]) {
    throw invalidSourcePayload(`${fieldName} row ${rowIndex} kosong atau melebihi batas panjang.`)
  }
  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
    throw invalidSourcePayload(`${fieldName} row ${rowIndex} mengandung karakter kontrol.`)
  }

  return normalized
}

function normalizeIpAddresses(value, rowIndex) {
  const source = readRequiredText(value, 'ipAddresses', rowIndex)
  const addresses = source.split(',').map((address) => address.trim())
  if (addresses.some((address) => !address || isIP(address) === 0)) {
    throw invalidSourcePayload(`IP Address row ${rowIndex} berisi alamat yang tidak valid.`)
  }

  // Satu perangkat dapat memiliki beberapa NIC; deduplikasi mempertahankan urutan dari sumber.
  return [...new Set(addresses)].join(', ')
}

function normalizeLastReportTime(value, rowIndex) {
  const source = readRequiredText(value, 'lastReportTime', rowIndex)
  if (!EXPLICIT_TIMEZONE_PATTERN.test(source)) {
    throw invalidSourcePayload(`Last Report Time row ${rowIndex} wajib menyertakan zona waktu.`)
  }

  const timestamp = Date.parse(source)
  if (!Number.isFinite(timestamp)) {
    throw invalidSourcePayload(`Last Report Time row ${rowIndex} tidak dapat dibaca.`)
  }

  // Frontend selalu menerima ISO UTC walaupun vendor mengirim format RFC dengan offset +0000.
  return new Date(timestamp).toISOString()
}

/**
 * Mapping positional vendor:
 * [hostname, ipAddresses, osVersion, processor, lastReportTime] -> Device canonical.
 * Patch Status dan Last Patch sengaja null sampai sumber khusus kedua field tersebut tersedia.
 */
export function normalizeCuReportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalidSourcePayload('Root respons report CU harus berupa object JSON.')
  }
  if (!Array.isArray(payload.result)) {
    throw invalidSourcePayload('Respons report CU harus memiliki array result.')
  }
  if (payload.result.length > MAX_REPORT_ROWS) {
    throw invalidSourcePayload(`Respons report CU melebihi batas ${MAX_REPORT_ROWS} row.`)
  }

  const seenIds = new Set()
  return payload.result.map((row, index) => {
    if (!Array.isArray(row) || row.length !== 5) {
      throw invalidSourcePayload(
        `Row report CU indeks ${index} harus mengikuti format [hostname, ipAddresses, osVersion, processor, lastReportTime].`,
      )
    }

    const hostname = readRequiredText(row[0], 'hostname', index)
    const id = hostname.toLowerCase()
    if (seenIds.has(id)) {
      throw invalidSourcePayload(`Hostname duplikat pada report CU: ${hostname}.`)
    }
    seenIds.add(id)

    return {
      // Hostname adalah ID sementara karena payload vendor belum menyediakan immutable computer ID.
      id,
      hostname,
      ipAddress: normalizeIpAddresses(row[1], index),
      osVersion: readRequiredText(row[2], 'osVersion', index),
      processor: readRequiredText(row[3], 'processor', index),
      patchStatus: null,
      lastPatch: null,
      lastReportTime: normalizeLastReportTime(row[4], index),
    }
  })
}

/** Mengambil report mentah melalui transport bersama lalu mengembalikan array Device canonical. */
export async function loadCuReport() {
  const payload = await fetchJsonSource({
    urlEnv: REPORT_SOURCE_URL_ENV,
    usernameEnv: SOURCE_USERNAME_ENV,
    passwordEnv: SOURCE_PASSWORD_ENV,
    sourceLabel: 'Sumber report CU',
    maxResponseBytes: MAX_REPORT_RESPONSE_BYTES,
  })

  return normalizeCuReportPayload(payload)
}
