// ---------------------------------------------------------------------------
// In-Memory Query Cache with TTL & Pattern Invalidation
// ---------------------------------------------------------------------------

class QueryCache {
  constructor() {
    this.store = new Map()
  }

  /**
   * Generate a normalized cache key
   * @param {string} prefix - e.g. 'catalog', 'detail', 'reviews'
   * @param {Object|string|number} params
   */
  generateKey(prefix, params = {}) {
    if (typeof params === 'string' || typeof params === 'number') {
      return `${prefix}:${params}`
    }
    // Normalize keys alphabetically for deterministic keys
    const sortedKeys = Object.keys(params).sort()
    const parts = sortedKeys
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map((k) => `${k}=${params[k]}`)
    return `${prefix}:${parts.join('&')}`
  }

  /**
   * Retrieve cached value if not expired
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const entry = this.store.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set cache entry with TTL (default 120s, clamped between 60 - 300s)
   * @param {string} key
   * @param {any} data
   * @param {number} ttlSeconds
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
   * Invalidate by exact key or prefix pattern
   * e.g. 'catalog', 'reviews'
   * @param {string} prefixOrKey
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
}

export const cache = new QueryCache()
