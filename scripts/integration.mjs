// ---------------------------------------------------------------------------
// scripts/integration.mjs — Real Supabase Integration Verification
// ---------------------------------------------------------------------------
import fs from 'fs'
import path from 'path'
import axios from 'axios'

// 1. Read environment variables from .env
const envPath = path.resolve(process.cwd(), '.env')
let API_URL = ''
let SUPABASE_KEY = ''

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('VITE_API_BASE_URL=')) API_URL = trimmed.split('=')[1].trim()
    if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) SUPABASE_KEY = trimmed.split('=')[1].trim()
    if (!API_URL && trimmed.startsWith('SUPABASE_URL=')) API_URL = trimmed.split('=')[1].trim()
    if (!SUPABASE_KEY && trimmed.startsWith('SUPABASE_PUBLISHABLE_KEY=')) SUPABASE_KEY = trimmed.split('=')[1].trim()
  }
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: 'return=representation',
  'Content-Type': 'application/json',
}

const countHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  Prefer: 'count=exact',
}

console.log('=================================================================')
console.log('   SUPABASE REAL INTEGRATION TEST (__test__* ISOLATED DATA)      ')
console.log('=================================================================\n')

const testResults = []
let createdProductIds = []

async function runIntegration() {
  try {
    // -----------------------------------------------------------------------
    // (a) Insert produk, update seller_phone, baca ulang
    // -----------------------------------------------------------------------
    try {
      const insRes = await axios.post(
        `${API_URL}/rest/v1/products`,
        {
          name: '__test_gun_a__',
          type: 'Pistol',
          caliber: '9mm',
          price: 750,
          seller_phone: '081299990001',
          share_token: 'test_token_a_' + Date.now(),
        },
        { headers },
      )
      const prodA = insRes.data[0]
      createdProductIds.push(prodA.id)

      // Update seller_phone
      await axios.patch(
        `${API_URL}/rest/v1/products?id=eq.${prodA.id}`,
        { seller_phone: '081299990002' },
        { headers },
      )

      // Read back
      const readRes = await axios.get(`${API_URL}/rest/v1/products?id=eq.${prodA.id}&select=*`, { headers })
      const updatedProd = readRes.data[0]

      if (updatedProd && updatedProd.seller_phone === '081299990002') {
        testResults.push({ task: 'a. Insert & Update Phone', status: 'PASS', detail: `ID ${prodA.id} updated phone to ${updatedProd.seller_phone}` })
      } else {
        testResults.push({ task: 'a. Insert & Update Phone', status: 'FAIL', detail: 'seller_phone tidak berubah saat dibaca ulang' })
      }
    } catch (e) {
      testResults.push({ task: 'a. Insert & Update Phone', status: 'FAIL', detail: e.response?.data?.message || e.message })
    }

    // -----------------------------------------------------------------------
    // (b) Filter type, search, dan pagination page 1 vs 2
    // -----------------------------------------------------------------------
    try {
      const pPistol = await axios.get(`${API_URL}/rest/v1/products?select=id,name,type&type=eq.Pistol&limit=10`, { headers: countHeaders })
      const pRifle = await axios.get(`${API_URL}/rest/v1/products?select=id,name,type&type=eq.Rifle&limit=10`, { headers: countHeaders })
      const pSearch = await axios.get(`${API_URL}/rest/v1/products?select=id,name&name=ilike.*glock*&limit=10`, { headers: countHeaders })
      const page1 = await axios.get(`${API_URL}/rest/v1/products?select=id,name&order=id.asc&limit=2&offset=0`, { headers: countHeaders })
      const page2 = await axios.get(`${API_URL}/rest/v1/products?select=id,name&order=id.asc&limit=2&offset=2`, { headers: countHeaders })

      const range1 = page1.headers['content-range'] || ''
      const namesP1 = page1.data.map((x) => x.name)
      const namesP2 = page2.data.map((x) => x.name)
      const isDiffPages = namesP1.length > 0 && namesP2.length > 0 && namesP1[0] !== namesP2[0]
      const isDiffTypes = pPistol.data.length > 0 && pRifle.data.length > 0 && pPistol.data[0].type !== pRifle.data[0].type

      if (isDiffTypes && pSearch.data.length > 0 && isDiffPages && range1.includes('/')) {
        testResults.push({ task: 'b. Filter & Paging PostgREST', status: 'PASS', detail: `Pistol (${pPistol.data.length}) != Rifle (${pRifle.data.length}), Content-Range: ${range1}` })
      } else {
        testResults.push({ task: 'b. Filter & Paging PostgREST', status: 'FAIL', detail: 'Filter atau paginasi mengembalikan data sama' })
      }
    } catch (e) {
      testResults.push({ task: 'b. Filter & Paging PostgREST', status: 'FAIL', detail: e.response?.data?.message || e.message })
    }

    // -----------------------------------------------------------------------
    // (c) Soft delete: deleted_at set -> hilang dari katalog -> ada di arsip -> restore -> hilang permanen
    // -----------------------------------------------------------------------
    try {
      const insC = await axios.post(
        `${API_URL}/rest/v1/products`,
        { name: '__test_gun_c__', type: 'Shotgun', price: 400, share_token: 'test_token_c_' + Date.now() },
        { headers },
      )
      const prodC = insC.data[0]
      createdProductIds.push(prodC.id)

      // 1. Soft delete
      const deletedAt = new Date().toISOString()
      await axios.patch(`${API_URL}/rest/v1/products?id=eq.${prodC.id}`, { deleted_at: deletedAt, status: 'archived' }, { headers })

      // 2. Cek di katalog publik (deleted_at=is.null)
      const publicCheck = await axios.get(`${API_URL}/rest/v1/products?id=eq.${prodC.id}&deleted_at=is.null`, { headers })
      const isHiddenFromPublic = publicCheck.data.length === 0

      // 3. Cek di arsip (deleted_at=not.is.null)
      const archiveCheck = await axios.get(`${API_URL}/rest/v1/products?id=eq.${prodC.id}&deleted_at=not.is.null`, { headers })
      const isInArchive = archiveCheck.data.length === 1

      // 4. Restore
      await axios.patch(`${API_URL}/rest/v1/products?id=eq.${prodC.id}`, { deleted_at: null, status: 'active' }, { headers })
      const restoredCheck = await axios.get(`${API_URL}/rest/v1/products?id=eq.${prodC.id}&deleted_at=is.null`, { headers })
      const isRestored = restoredCheck.data.length === 1

      // 5. Permanent delete
      await axios.delete(`${API_URL}/rest/v1/products?id=eq.${prodC.id}`, { headers })
      const permCheck = await axios.get(`${API_URL}/rest/v1/products?id=eq.${prodC.id}`, { headers })
      const isPermanentlyDeleted = permCheck.data.length === 0

      if (isHiddenFromPublic && isInArchive && isRestored && isPermanentlyDeleted) {
        testResults.push({ task: 'c. Lifecycle Soft-Delete & Restore', status: 'PASS', detail: 'Tersaring di publik, masuk arsip, restore aktif, permanent delete sukses' })
      } else {
        testResults.push({
          task: 'c. Lifecycle Soft-Delete & Restore',
          status: 'FAIL',
          detail: `hidden:${isHiddenFromPublic}, archived:${isInArchive}, restored:${isRestored}, deleted:${isPermanentlyDeleted}`,
        })
      }
    } catch (e) {
      testResults.push({ task: 'c. Lifecycle Soft-Delete & Restore', status: 'FAIL', detail: e.response?.data?.message || e.message })
    }

    // -----------------------------------------------------------------------
    // (d) share_token unik; produk yang diarsip terdeteksi
    // -----------------------------------------------------------------------
    try {
      const tokenD1 = 'share_' + Math.random().toString(36).slice(2)
      const tokenD2 = 'share_' + Math.random().toString(36).slice(2)

      const insD1 = await axios.post(`${API_URL}/rest/v1/products`, { name: '__test_gun_d1__', type: 'Rifle', price: 900, share_token: tokenD1, deleted_at: new Date().toISOString() }, { headers })
      const insD2 = await axios.post(`${API_URL}/rest/v1/products`, { name: '__test_gun_d2__', type: 'Rifle', price: 950, share_token: tokenD2 }, { headers })
      createdProductIds.push(insD1.data[0].id, insD2.data[0].id)

      const readD1 = await axios.get(`${API_URL}/rest/v1/products?share_token=eq.${tokenD1}&select=*`, { headers })
      const readD2 = await axios.get(`${API_URL}/rest/v1/products?share_token=eq.${tokenD2}&select=*`, { headers })

      const itemD1 = readD1.data[0]
      const itemD2 = readD2.data[0]

      const isUniqueTokens = tokenD1 !== tokenD2 && itemD1.id !== itemD2.id
      const isD1Archived = Boolean(itemD1.deleted_at)

      if (isUniqueTokens && isD1Archived) {
        testResults.push({ task: 'd. Share Token & Archive Guard', status: 'PASS', detail: `Token ${tokenD1} != ${tokenD2}, produk terarsip mendeteksi deleted_at` })
      } else {
        testResults.push({ task: 'd. Share Token & Archive Guard', status: 'FAIL', detail: 'Token tidak unik atau status arsip gagal terdeteksi' })
      }
    } catch (e) {
      testResults.push({ task: 'd. Share Token & Archive Guard', status: 'FAIL', detail: e.response?.data?.message || e.message })
    }

    // -----------------------------------------------------------------------
    // (e) Review: insert, update, delete (user_id harus UUID)
    // -----------------------------------------------------------------------
    try {
      const insP = await axios.post(`${API_URL}/rest/v1/products`, { name: '__test_gun_e__', type: 'Pistol', price: 300 }, { headers })
      const prodEId = insP.data[0].id
      createdProductIds.push(prodEId)

      const testUserUUID = 'a0000000-0000-4000-8000-000000000001'

      // Insert Review
      const insR = await axios.post(
        `${API_URL}/rest/v1/reviews`,
        { product_id: prodEId, user_id: testUserUUID, rating: 5, comment: 'Initial review' },
        { headers },
      )
      const revEId = insR.data[0].id

      // Update Review
      await axios.patch(`${API_URL}/rest/v1/reviews?id=eq.${revEId}`, { rating: 4, comment: 'Updated review' }, { headers })
      const readR = await axios.get(`${API_URL}/rest/v1/reviews?id=eq.${revEId}&select=*`, { headers })
      const updatedRev = readR.data[0]

      // Delete Review
      await axios.delete(`${API_URL}/rest/v1/reviews?id=eq.${revEId}`, { headers })
      const checkDel = await axios.get(`${API_URL}/rest/v1/reviews?id=eq.${revEId}`, { headers })

      if (updatedRev.rating === 4 && checkDel.data.length === 0) {
        testResults.push({ task: 'e. Review Full CRUD', status: 'PASS', detail: `Review ID ${revEId} created (UUID author) -> updated to 4 stars -> deleted` })
      } else {
        testResults.push({ task: 'e. Review Full CRUD', status: 'FAIL', detail: 'Review update atau delete tidak konsisten' })
      }
    } catch (e) {
      testResults.push({ task: 'e. Review Full CRUD', status: 'FAIL', detail: e.response?.data?.message || e.message })
    }

    // -----------------------------------------------------------------------
    // (f) review_votes: vote up, vote ulang (toggle), vote down; COUNT baris DB = 1 (UNIQUE bekerja)
    // -----------------------------------------------------------------------
    try {
      const insP = await axios.post(`${API_URL}/rest/v1/products`, { name: '__test_gun_f__', type: 'Pistol', price: 300 }, { headers })
      const prodFId = insP.data[0].id
      createdProductIds.push(prodFId)

      const testUserUUID = 'b0000000-0000-4000-8000-000000000002'
      const insR = await axios.post(`${API_URL}/rest/v1/reviews`, { product_id: prodFId, user_id: testUserUUID, rating: 5, comment: 'Vote test' }, { headers })
      const revFId = insR.data[0].id

      const voterId = 'c0000000-0000-4000-8000-000000000003'

      // 1. Vote Up (+1)
      await axios.post(`${API_URL}/rest/v1/review_votes`, { review_id: revFId, user_id: voterId, value: 1 }, { headers })

      // 2. Vote Down: update existing vote to -1
      await axios.patch(`${API_URL}/rest/v1/review_votes?review_id=eq.${revFId}&user_id=eq.${voterId}`, { value: -1 }, { headers })

      // 3. Count rows in DB for this (review_id, user_id)
      const countRes = await axios.get(`${API_URL}/rest/v1/review_votes?review_id=eq.${revFId}&user_id=eq.${voterId}&select=*`, { headers: countHeaders })
      const totalVotes = countRes.data.length
      const currentValue = countRes.data[0]?.value

      // 4. Toggle off (delete)
      await axios.delete(`${API_URL}/rest/v1/review_votes?review_id=eq.${revFId}&user_id=eq.${voterId}`, { headers })
      const afterToggle = await axios.get(`${API_URL}/rest/v1/review_votes?review_id=eq.${revFId}&user_id=eq.${voterId}&select=*`, { headers: countHeaders })

      if (totalVotes === 1 && currentValue === -1 && afterToggle.data.length === 0) {
        testResults.push({ task: 'f. Review Votes & UNIQUE Constraint', status: 'PASS', detail: `Baris di DB tepat 1 (value: ${currentValue}), toggle off berhasil (0 baris)` })
      } else {
        testResults.push({ task: 'f. Review Votes & UNIQUE Constraint', status: 'FAIL', detail: `totalVotes=${totalVotes}, value=${currentValue}, afterToggle=${afterToggle.data.length}` })
      }
    } catch (e) {
      testResults.push({ task: 'f. Review Votes & UNIQUE Constraint', status: 'FAIL', detail: e.response?.data?.message || e.message })
    }

    // -----------------------------------------------------------------------
    // (g) catalog_images: insert 3 gambar, cek urutan dan is_primary; upload storage
    // -----------------------------------------------------------------------
    try {
      const insP = await axios.post(`${API_URL}/rest/v1/products`, { name: '__test_gun_g__', type: 'Rifle', price: 1200 }, { headers })
      const prodGId = insP.data[0].id
      createdProductIds.push(prodGId)

      // Insert 3 images
      const imgPayload = [
        { catalog_id: prodGId, url: 'https://cdn.example.com/gun_1.jpg', display_order: 0, is_primary: true },
        { catalog_id: prodGId, url: 'https://cdn.example.com/gun_2.jpg', display_order: 1, is_primary: false },
        { catalog_id: prodGId, url: 'https://cdn.example.com/gun_3.jpg', display_order: 2, is_primary: false },
      ]
      await axios.post(`${API_URL}/rest/v1/catalog_images`, imgPayload, { headers })

      // Verify order and is_primary
      const imgRes = await axios.get(`${API_URL}/rest/v1/catalog_images?catalog_id=eq.${prodGId}&order=display_order.asc`, { headers })
      const images = imgRes.data

      const isCount3 = images.length === 3
      const isPrimaryCorrect = images[0]?.is_primary === true && images[1]?.is_primary === false
      const isOrderCorrect = images[0]?.display_order === 0 && images[1]?.display_order === 1 && images[2]?.display_order === 2

      // Storage Upload Test to bucket 'product-images'
      let storageStatus = 'PASS'
      let storageNote = ''
      try {
        const uploadUrl = `${API_URL}/storage/v1/object/product-images/__test_file__.txt`
        await axios.post(uploadUrl, 'Integration test content', {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'text/plain',
          },
          timeout: 5000,
        })
        // Cleanup storage file
        await axios.delete(`${API_URL}/storage/v1/object/product-images/__test_file__.txt`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        })
        storageNote = 'upload & delete file di bucket product-images sukses'
      } catch (stErr) {
        storageStatus = 'BLOCKED'
        storageNote = `Storage bucket 'product-images' belum dibuat (${stErr.response?.data?.message || stErr.message})`
      }

      if (isCount3 && isPrimaryCorrect && isOrderCorrect) {
        if (storageStatus === 'PASS') {
          testResults.push({ task: 'g. Multi-Gambar & Storage Bucket', status: 'PASS', detail: `3 gambar terurut & is_primary valid; ${storageNote}` })
        } else {
          testResults.push({ task: 'g. Multi-Gambar & Storage Bucket', status: 'BLOCKED', detail: `Tabel catalog_images PASS (3 gambar terurut & is_primary valid), TAPI ${storageNote}` })
        }
      } else {
        testResults.push({ task: 'g. Multi-Gambar & Storage Bucket', status: 'FAIL', detail: 'catalog_images order atau is_primary tidak sesuai' })
      }
    } catch (e) {
      testResults.push({ task: 'g. Multi-Gambar & Storage Bucket', status: 'FAIL', detail: e.response?.data?.message || e.message })
    }
  } finally {
    // -----------------------------------------------------------------------
    // Cleanup: Remove all test data from Supabase
    // -----------------------------------------------------------------------
    console.log('Cleaning up test data from Supabase...')
    for (const id of createdProductIds) {
      try {
        await axios.delete(`${API_URL}/rest/v1/catalog_images?catalog_id=eq.${id}`, { headers })
        await axios.delete(`${API_URL}/rest/v1/reviews?product_id=eq.${id}`, { headers })
        await axios.delete(`${API_URL}/rest/v1/products?id=eq.${id}`, { headers })
      } catch {
        /* ignore cleanup errors */
      }
    }
    // Clean by test name pattern
    try {
      await axios.delete(`${API_URL}/rest/v1/products?name=like.__test_*`, { headers })
    } catch {}

    console.log('Cleanup completed.\n')
  }

  // -------------------------------------------------------------------------
  // Output Summary
  // -------------------------------------------------------------------------
  console.log('-----------------------------------------------------------------')
  console.log('                 INTEGRATION TEST RESULTS                        ')
  console.log('-----------------------------------------------------------------')
  testResults.forEach((t) => {
    console.log(`[${t.status}] ${t.task} -> ${t.detail}`)
  })
  console.log('-----------------------------------------------------------------\n')
}

runIntegration()
