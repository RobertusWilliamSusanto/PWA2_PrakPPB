import { apiClient, IS_SUPABASE } from '../config/api.js'
import { cache } from '../utils/cache.js'
import { getUserIdentifier } from './userService.js'
import { getSchemaStatus } from '../utils/schemaDetector.js'

// ---------------------------------------------------------------------------
// Share Token Generator (nanoid/UUID-based, unguessable)
// ---------------------------------------------------------------------------
export const generateShareToken = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
}

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : [
          'Verify firearm is completely unloaded and point in safe direction.',
          'Inspect receiver and mechanism for maintenance.',
        ]

  // Resolve multi-images
  let images = []
  if (Array.isArray(item.catalog_images) && item.catalog_images.length > 0) {
    images = item.catalog_images
      .map((img) => (typeof img === 'string' ? { url: img, display_order: 0 } : img))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  } else if (Array.isArray(item.images) && item.images.length > 0) {
    images = item.images.map((img, idx) =>
      typeof img === 'string' ? { url: img, display_order: idx, is_primary: idx === 0 } : img,
    )
  } else if (item.image_url || item.image) {
    images = [{ url: item.image_url || item.image, display_order: 0, is_primary: true }]
  } else {
    images = [{ url: '/guns/pistol.svg', display_order: 0, is_primary: true }]
  }

  const primaryImage = images.find((i) => i.is_primary)?.url || images[0]?.url || '/guns/pistol.svg'

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: primaryImage,
    image: primaryImage,
    images: images,
    ingredients: specsList,
    steps: stepsList,
    share_token: item.share_token || `bb_${String(item.id || 'gun')}`,
    deleted_at: item.deleted_at || null,
    status: item.status || (item.deleted_at ? 'archived' : 'active'),
    seller_phone: item.seller_phone || item.contact_phone || '', // NO FAKE NUMBER DEFAULT!
    user_id: item.user_id || null,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints with soft-delete, server-side pagination,
// multi-images, share token lookup, and deterministic query caching.
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products with server-side pagination & cache.
   * Uses Prefer: count=exact and reads Content-Range for accurate total count.
   */
  async getGuns(params = {}) {
    const page = Number(params.page) || 1
    const limit = Number(params.limit) || 12
    const category = params.category || 'All'
    const caliber = params.caliber || ''
    const search = params.search || ''
    const minPrice = params.minPrice || ''
    const maxPrice = params.maxPrice || ''
    const sortBy = params.sort_by || 'name'
    const sortOrder = params.order || 'asc'
    const archived = Boolean(params.archived)

    // Deterministic cache key matching user requirement:
    // guns:${JSON.stringify({page,limit,type,caliber,minPrice,maxPrice,q,sort,archived})}
    const cacheKey = cache.generateKey('guns', {
      page,
      limit,
      type: category,
      caliber,
      minPrice,
      maxPrice,
      q: search,
      sort: `${sortBy}_${sortOrder}`,
      archived,
    })

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached) {
      return cached
    }

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      const queryParts = ['select=*']

      // Only filter deleted_at if the column actually exists in DB
      if (schema.hasDeletedAt) {
        if (archived) {
          queryParts.push('deleted_at=not.is.null')
        } else {
          queryParts.push('deleted_at=is.null')
        }
      } else if (archived) {
        // Migration not yet applied; no archived items available in DB
        return {
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        }
      }

      if (search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(search)}*`)
      }

      if (category && category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(category)}`)
      }

      if (caliber) {
        queryParts.push(`caliber=eq.${encodeURIComponent(caliber)}`)
      }

      if (minPrice) {
        queryParts.push(`price=gte.${Number(minPrice)}`)
      }

      if (maxPrice) {
        queryParts.push(`price=lte.${Number(maxPrice)}`)
      }

      if (sortBy) {
        const order = sortOrder === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(sortBy)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc')
      }

      // Server-side paging with limit & offset
      const offset = (page - 1) * limit
      queryParts.push(`limit=${limit}`)
      queryParts.push(`offset=${offset}`)

      const queryString = queryParts.join('&')

      // SINGLE HTTP GET request with Prefer: count=exact and returnHeaders: true
      const res = await apiClient.get(`/rest/v1/products?${queryString}`, {
        headers: { Prefer: 'count=exact' },
        returnHeaders: true,
      })

      // Parse total count from Content-Range header (e.g. "0-11/45")
      const contentRange = res.headers?.['content-range'] || ''
      let total = Array.isArray(res.data) ? res.data.length : 0
      if (contentRange && contentRange.includes('/')) {
        const totalStr = contentRange.split('/')[1]
        if (totalStr && totalStr !== '*') {
          const parsed = parseInt(totalStr, 10)
          if (!isNaN(parsed)) total = parsed
        }
      }

      const totalPages = Math.max(1, Math.ceil(total / limit))
      const list = Array.isArray(res.data) ? res.data.map(normalizeProduct) : []

      const result = {
        success: true,
        data: list,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      }

      // Cache for 120s
      cache.set(cacheKey, result, 120)
      return result
    }

    // Fallback: university REST API or local
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    const res = await apiClient.get('/api/v1/recipes', { params: clean })
    cache.set(cacheKey, res, 120)
    return res
  }

  /**
   * Fetch archived (soft-deleted) items for the owner view.
   */
  async getArchivedGuns(params = {}) {
    return this.getGuns({ ...params, archived: true })
  }

  /**
   * Fetch a single product by ID (including multi-images from catalog_images).
   */
  async getGunById(id) {
    if (typeof id === 'string' && id.startsWith('local-')) {
      const { GUNS_LOCAL } = await import('../data/guns.js')
      const found = GUNS_LOCAL.find((g, idx) => String(g.id || `local-${idx}`) === String(id))
      if (found) return { success: true, data: normalizeProduct(found) }
      throw new Error('Hardware item not found.')
    }

    const cacheKey = cache.generateKey('gun:detail', id)
    const cached = cache.get(cacheKey)
    if (cached) return cached

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      let data = null

      if (schema.hasCatalogImages) {
        try {
          data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*,catalog_images(*)`)
        } catch {
          data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
        }
      } else {
        data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      }

      if (Array.isArray(data) && data.length > 0) {
        const product = normalizeProduct(data[0])

        // If images weren't joined and table exists, try fetching catalog_images separately
        if (schema.hasCatalogImages && (!product.images || product.images.length <= 1)) {
          try {
            const imgData = await apiClient.get(
              `/rest/v1/catalog_images?catalog_id=eq.${id}&order=display_order.asc`,
            )
            if (Array.isArray(imgData) && imgData.length > 0) {
              product.images = imgData
              product.image_url = imgData[0].url
              product.image = imgData[0].url
            }
          } catch (e) {
            console.warn('[gunService] Could not load catalog_images:', e.message)
          }
        }

        const res = { success: true, data: product }
        cache.set(cacheKey, res, 120)
        return res
      }
      throw new Error('Hardware item not found.')
    }

    const res = await apiClient.get(`/api/v1/recipes/${id}`)
    cache.set(cacheKey, res, 120)
    return res
  }

  /**
   * Fetch product by public share_token.
   */
  async getGunByShareToken(token) {
    if (!token) throw new Error('Invalid share token.')
    const cacheKey = cache.generateKey('gun:share', token)
    const cached = cache.get(cacheKey)
    if (cached) return cached

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      let data = []

      if (schema.hasShareToken) {
        data = await apiClient.get(`/rest/v1/products?share_token=eq.${token}&select=*`)
      } else {
        // Fallback if share_token column not yet migrated
        const rawId = token.startsWith('bb_') ? token.slice(3) : token
        if (/^\d+$/.test(rawId)) {
          data = await apiClient.get(`/rest/v1/products?id=eq.${rawId}&select=*`)
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        const item = data[0]
        const isArchived = Boolean(item.deleted_at || item.status === 'archived')
        const product = normalizeProduct(item)

        // Fetch multi-images if table exists
        if (schema.hasCatalogImages) {
          try {
            const imgData = await apiClient.get(
              `/rest/v1/catalog_images?catalog_id=eq.${item.id}&order=display_order.asc`,
            )
            if (Array.isArray(imgData) && imgData.length > 0) {
              product.images = imgData
              product.image_url = imgData[0].url
            }
          } catch (e) {
            console.warn('[gunService] Share image fetch fallback:', e.message)
          }
        }

        const res = { success: true, data: product, isArchived }
        cache.set(cacheKey, res, 120)
        return res
      }
    }

    throw new Error('Produk tidak ditemukan atau link share tidak valid.')
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    // Invalidate all guns cache keys as required
    cache.invalidate('guns')

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const shareToken = generateShareToken()
      const primaryUrl =
        data.images && data.images.length > 0
          ? typeof data.images[0] === 'string'
            ? data.images[0]
            : data.images[0].url
          : data.image_url || '/guns/pistol.svg'

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: primaryUrl,
      }

      // Only include newly migrated columns if they exist in DB
      if (schema.hasShareToken) payload.share_token = shareToken
      if (schema.hasStatus) payload.status = data.status || 'active'
      if (schema.hasSellerPhone && data.seller_phone) payload.seller_phone = data.seller_phone
      if (schema.hasDeletedAt) payload.deleted_at = null
      if (schema.hasUserId) payload.user_id = data.user_id || getUserIdentifier()

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res

      // Insert multi-images to catalog_images table if available
      if (schema.hasCatalogImages && created?.id && Array.isArray(data.images) && data.images.length > 0) {
        try {
          const imageRows = data.images.map((img, idx) => ({
            catalog_id: created.id,
            url: typeof img === 'string' ? img : img.url,
            display_order: idx,
            is_primary: idx === 0,
          }))
          await apiClient.post('/rest/v1/catalog_images', imageRows)
        } catch (imgErr) {
          console.warn('[gunService] Could not save to catalog_images:', imgErr.message)
        }
      }

      return { success: true, data: normalizeProduct(created) }
    }

    return apiClient.post('/api/v1/recipes', data)
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    if (typeof id === 'string' && id.startsWith('local-')) {
      return { success: false, error: 'Local product cannot be modified on server' }
    }
    cache.invalidate('guns')

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (schema.hasSellerPhone && data.seller_phone !== undefined) {
        payload.seller_phone = data.seller_phone
      }
      if (schema.hasStatus && data.status !== undefined) {
        payload.status = data.status
      }

      if (Array.isArray(data.images) && data.images.length > 0) {
        const primaryUrl = typeof data.images[0] === 'string' ? data.images[0] : data.images[0].url
        payload.image_url = primaryUrl
      } else if (data.image_url !== undefined) {
        payload.image_url = data.image_url
      }

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res

      // Sync multi-images if table exists
      if (schema.hasCatalogImages && Array.isArray(data.images)) {
        try {
          await apiClient.delete(`/rest/v1/catalog_images?catalog_id=eq.${id}`)
          if (data.images.length > 0) {
            const imageRows = data.images.map((img, idx) => ({
              catalog_id: id,
              url: typeof img === 'string' ? img : img.url,
              display_order: idx,
              is_primary: idx === 0,
            }))
            await apiClient.post('/rest/v1/catalog_images', imageRows)
          }
        } catch (imgErr) {
          console.warn('[gunService] Could not sync catalog_images:', imgErr.message)
        }
      }

      return { success: true, data: normalizeProduct(updated) }
    }

    return apiClient.put(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Soft delete (archive) product.
   */
  async deleteGun(id) {
    if (typeof id === 'string' && id.startsWith('local-')) {
      return { success: true, archived: true }
    }
    cache.invalidate('guns')

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      if (schema.hasDeletedAt) {
        await apiClient.patch(
          `/rest/v1/products?id=eq.${id}`,
          {
            deleted_at: new Date().toISOString(),
            status: 'archived',
          },
          { headers: { Prefer: 'return=representation' } },
        )
        return { success: true, archived: true }
      } else {
        // Fallback if deleted_at column does not exist
        console.warn(
          '[gunService] Kolom deleted_at belum ada. Menghapus data permanen. Terapkan migration 20261101_combined_schema.sql untuk soft-delete.',
        )
        await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
        return { success: true, archived: false }
      }
    }

    return apiClient.delete(`/api/v1/recipes/${id}`)
  }

  /**
   * Restore archived product back to active catalog.
   */
  async restoreGun(id) {
    if (typeof id === 'string' && id.startsWith('local-')) {
      return { success: true }
    }
    cache.invalidate('guns')

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      if (schema.hasDeletedAt) {
        await apiClient.patch(
          `/rest/v1/products?id=eq.${id}`,
          {
            deleted_at: null,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { headers: { Prefer: 'return=representation' } },
        )
      }
      return { success: true }
    }

    return { success: true }
  }

  /**
   * Permanently delete product from database.
   */
  async permanentDeleteGun(id) {
    if (typeof id === 'string' && id.startsWith('local-')) {
      return { success: true }
    }
    cache.invalidate('guns')

    if (IS_SUPABASE) {
      const schema = getSchemaStatus()
      if (schema.hasCatalogImages) {
        try {
          await apiClient.delete(`/rest/v1/catalog_images?catalog_id=eq.${id}`)
        } catch (e) {
          console.warn('[gunService] catalog_images delete fallback:', e.message)
        }
      }
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      return { success: true }
    }

    return apiClient.delete(`/api/v1/recipes/${id}`)
  }
}

export default new GunService()
