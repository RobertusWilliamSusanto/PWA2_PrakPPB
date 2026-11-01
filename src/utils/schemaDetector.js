import axios from 'axios'
import { BASE_URL, SUPABASE_KEY, IS_SUPABASE } from '../config/api.js'

// ---------------------------------------------------------------------------
// Schema Detector — dynamically inspects Supabase to check if migration
// 20261101_combined_schema.sql has been applied or if compatibility mode is active.
// ---------------------------------------------------------------------------

let schemaStatus = {
  checked: false,
  isSupabase: IS_SUPABASE,
  hasDeletedAt: false,
  hasShareToken: false,
  hasSellerPhone: false,
  hasCatalogImages: false,
  hasReviewVotes: false,
  missingMigrations: [],
}

const listeners = new Set()

export function subscribeSchemaStatus(callback) {
  listeners.add(callback)
  if (schemaStatus.checked) {
    callback(schemaStatus)
  }
  return () => listeners.delete(callback)
}

function notifyListeners() {
  for (const cb of listeners) {
    try {
      cb(schemaStatus)
    } catch (e) {
      console.error('[SchemaDetector] Listener error:', e)
    }
  }
}

export function getSchemaStatus() {
  return schemaStatus
}

export async function detectSchema() {
  if (schemaStatus.checked) return schemaStatus

  if (!IS_SUPABASE || !BASE_URL) {
    schemaStatus.checked = true
    return schemaStatus
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  }

  const missing = []

  // 1. Check products.deleted_at
  try {
    await axios.get(`${BASE_URL}/rest/v1/products?select=deleted_at&limit=1`, { headers, timeout: 5000 })
    schemaStatus.hasDeletedAt = true
  } catch {
    schemaStatus.hasDeletedAt = false
    missing.push('Kolom products.deleted_at')
  }

  // 2. Check products.share_token
  try {
    await axios.get(`${BASE_URL}/rest/v1/products?select=share_token&limit=1`, { headers, timeout: 5000 })
    schemaStatus.hasShareToken = true
  } catch {
    schemaStatus.hasShareToken = false
    missing.push('Kolom products.share_token')
  }

  // 3. Check products.seller_phone
  try {
    await axios.get(`${BASE_URL}/rest/v1/products?select=seller_phone&limit=1`, { headers, timeout: 5000 })
    schemaStatus.hasSellerPhone = true
  } catch {
    schemaStatus.hasSellerPhone = false
    missing.push('Kolom products.seller_phone')
  }

  // 4. Check catalog_images table
  try {
    await axios.get(`${BASE_URL}/rest/v1/catalog_images?limit=1`, { headers, timeout: 5000 })
    schemaStatus.hasCatalogImages = true
  } catch {
    schemaStatus.hasCatalogImages = false
    missing.push('Tabel public.catalog_images')
  }

  // 5. Check review_votes table
  try {
    await axios.get(`${BASE_URL}/rest/v1/review_votes?limit=1`, { headers, timeout: 5000 })
    schemaStatus.hasReviewVotes = true
  } catch {
    schemaStatus.hasReviewVotes = false
    missing.push('Tabel public.review_votes')
  }

  schemaStatus.missingMigrations = missing
  schemaStatus.checked = true

  if (missing.length > 0) {
    console.warn(
      `[SchemaDetector] PERHATIAN: Skema belum lengkap. Fitur berikut belum ada di Supabase: ${missing.join(
        ', ',
      )}. Jalankan file migration 'supabase/migrations/20261101_combined_schema.sql' di Supabase SQL Editor. Aplikasi tetap berjalan dalam mode kompatibilitas aman.`,
    )
  }

  notifyListeners()
  return schemaStatus
}

// Kick off detection on import
detectSchema().catch((err) => {
  console.warn('[SchemaDetector] Error during schema detection:', err.message)
})
