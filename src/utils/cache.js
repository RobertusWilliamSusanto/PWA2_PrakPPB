// ---------------------------------------------------------------------------
// In-Memory Query Cache with Deterministic JSON Keys & Prefix Invalidation
// ---------------------------------------------------------------------------

class QueryCache {
  constructor() {
    this.store = new Map()
  }

  /**
   * Generate a deterministic cache key matching user specification:
   * guns:${JSON.stringify({page,limit,type,caliber,minPrice,maxPrice,q,sort,...})}
   */
  generateKey(prefix = 'guns', params = {}) {
    if (typeof params === 'string' || typeof params === 'number') {
      return `${prefix}:${params}`
    }

    // Sort keys alphabetically so order of insertion doesn't affect key
    const normalized = {}
    const sortedKeys = Object.keys(params).sort()
    for (const k of sortedKeys) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        normalized[k] = params[k]
      }
    }

    return `${prefix}:${JSON.stringify(normalized)}`
  }

  /**
   * Retrieve cached value if not expired
   */
  get(key) {
    const entry = this.store.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    if (typeof window !== 'undefined' && (window.__DEBUG_CACHE__ || import.meta.env?.DEV)) {
      console.log(`%c[CACHE HIT] %c${key}`, 'color: #10b981; font-weight: bold', 'color: #94a3b8')
    }

    return entry.data
  }

  /**
   * Set cache entry with TTL (default 120s, clamped between 60 - 300s)
   */
  set(key, data, ttlSeconds = 120) {
    const effectiveTTL = Math.max(60, Math.min(300, ttlSeconds))
    this.store.set(key, {
      data,
      expiresAt: Date.now() + effectiveTTL * 1000,
      createdAt: Date.now(),
    })
  }

  /**
   * Invalidate by exact key or prefix pattern (e.g. 'guns:')
   */
  invalidate(prefixOrKey) {
    if (!prefixOrKey) {
      this.store.clear()
      return
    }

    for (const key of this.store.keys()) {
      if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.store.clear()
  }

  /**
   * Return all active cache keys (for debugging / verification)
   */
  keys() {
    return Array.from(this.store.keys())
  }

  /**
   * Inspect cache content with remaining TTL
   */
  inspect() {
    const list = []
    for (const [key, entry] of this.store.entries()) {
      const ttlRemaining = Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000))
      list.push({ key, ttlRemaining: `${ttlRemaining}s`, data: entry.data })
    }
    return list
  }
}

export const cache = new QueryCache()

if (typeof window !== 'undefined') {
  window.__cache = cache
}
