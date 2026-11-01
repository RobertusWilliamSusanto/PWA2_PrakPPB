import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Plus,
  Loader,
  AlertCircle,
  PackageOpen,
  ChevronLeft,
  ChevronRight,
  Archive,
} from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import DevMigrationBanner from '../components/common/DevMigrationBanner'
import gunService from '../services/gunService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

const PAGE_SIZE = 12

/**
 * Catalog page with server-side pagination, query caching, soft-delete archive,
 * and URL query string preservation.
 */
export default function Catalog({ onNavigate }) {
  // Read initial filter & page params from query string
  const urlParams = new URLSearchParams(window.location.search)
  const [page, setPage] = useState(() => Math.max(1, parseInt(urlParams.get('page') || '1', 10)))
  const [search, setSearch] = useState(() => urlParams.get('search') || '')
  const [activeCategory, setActiveCategory] = useState(() => urlParams.get('category') || 'All')
  const [sortKey, setSortKey] = useState(() => urlParams.get('sort') || 'name')
  const [sortOrder, setSortOrder] = useState(() => urlParams.get('order') || 'asc')

  // Sync state to URL query string so search/filter/page are retained
  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', page)
    if (search) params.set('search', search)
    if (activeCategory !== 'All') params.set('category', activeCategory)
    if (sortKey !== 'name') params.set('sort', sortKey)
    if (sortOrder !== 'asc') params.set('order', sortOrder)

    const newQuery = params.toString()
    const newRelativePathQuery = window.location.pathname + (newQuery ? `?${newQuery}` : '')
    window.history.replaceState(null, '', newRelativePathQuery)
  }, [page, search, activeCategory, sortKey, sortOrder])

  // Fetch from server with pagination and filter params
  const { guns: apiGuns, loading, error, pagination, refetch } = useGuns({
    page,
    limit: PAGE_SIZE,
    search,
    category: activeCategory,
    sort_by: sortKey,
    order: sortOrder,
  })

  // Fallback GUNS_LOCAL HANYA aktif saat network error
  const isNetworkError = Boolean(
    error &&
      ((typeof navigator !== 'undefined' && !navigator.onLine) ||
        error.toLowerCase().includes('network') ||
        error.toLowerCase().includes('connection') ||
        error.toLowerCase().includes('unable to reach')),
  )
  const isFallbackLocal = Boolean(isNetworkError && apiGuns.length === 0)

  // Available categories extracted from local master list
  const categories = useMemo(() => {
    return extractCategories(GUNS_LOCAL)
  }, [])

  // If server data is available, it is ALREADY filtered and paginated server-side.
  // If in fallback mode, apply filtering, sorting, and pagination locally.
  const displayedGuns = useMemo(() => {
    if (isFallbackLocal) {
      const enrichedLocal = GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
      let filtered = enrichedLocal.filter(
        (g) => matchesSearch(g, search) && matchesCategory(g, activeCategory),
      )
      filtered = sortItems(filtered, sortKey, sortOrder)
      const start = (page - 1) * PAGE_SIZE
      return filtered.slice(start, start + PAGE_SIZE)
    }
    return apiGuns
  }, [apiGuns, search, activeCategory, sortKey, sortOrder, page, isFallbackLocal])

  const totalCount = useMemo(() => {
    if (isFallbackLocal) {
      return GUNS_LOCAL.filter(
        (g) => matchesSearch(g, search) && matchesCategory(g, activeCategory),
      ).length
    }
    return pagination?.total ?? displayedGuns.length
  }, [isFallbackLocal, search, activeCategory, pagination, displayedGuns.length])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Reset page to 1 when filters change
  const handleSearchChange = useCallback((val) => {
    setSearch(val)
    setPage(1)
  }, [])

  const handleCategoryChange = useCallback((cat) => {
    setActiveCategory(cat)
    setPage(1)
  }, [])

  const handleSortChange = useCallback(({ key, order }) => {
    setSortKey(key)
    setSortOrder(order)
    setPage(1)
  }, [])

  // Detail view
  const [selectedGun, setSelectedGun] = useState(null)

  // Soft delete target
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      await gunService.deleteGun(deleteTarget.id)
      setActionSuccess(`"${deleteTarget.name}" berhasil dipindahkan ke Arsip.`)
      setDeleteTarget(null)
      refetch()
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (err) {
      setDeleteError(err.message || 'Gagal mengarsipkan katalog.')
    } finally {
      setDeleting(false)
    }
  }

  const handlePageChange = useCallback(
    (newPage) => {
      const target = Math.max(1, Math.min(totalPages, newPage))
      setPage(target)
      window.scrollTo({ top: 120, behavior: 'smooth' })
    },
    [totalPages],
  )

  // If viewing a single product detail
  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => {
          setSelectedGun(null)
          setDeleteTarget(g)
        }}
      />
    )
  }

  return (
    <>
      <DevMigrationBanner />

      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed with its type,
          caliber, and price — nothing else.
        </p>
      </section>

      {actionSuccess && (
        <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded text-sm max-w-5xl mx-auto">
          {actionSuccess}
        </div>
      )}

      <section>
        <div className="list-head flex justify-between items-center mb-4">
          <h2>Current stock</h2>
          <div className="list-head-right flex items-center gap-3">
            <span className="count text-sm text-stone-400">
              {totalCount} piece{totalCount !== 1 ? 's' : ''} total
            </span>

            {onNavigate && (
              <button
                type="button"
                className="btn btn--outline btn--sm flex items-center gap-1.5"
                onClick={() => onNavigate('Archive')}
                title="Buka Arsip Katalog"
              >
                <Archive size={14} /> Arsip
              </button>
            )}

            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm flex items-center gap-1"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={handleSearchChange}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={handleCategoryChange}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSortChange}
        />

        {/* States */}
        {loading && (
          <div className="state-box py-16 text-center flex flex-col items-center justify-center">
            <Loader size={28} className="spin text-amber-500 mb-2" />
            <p className="text-stone-400">Loading catalog page {page}…</p>
          </div>
        )}

        {!loading && error && !isFallbackLocal && (
          <div className="state-box state-box--error p-6 bg-red-950/30 border border-red-800 rounded text-center">
            <AlertCircle size={28} className="mx-auto mb-2 text-red-400" />
            <p className="text-red-300">{error}</p>
            <div className="state-box__actions mt-4 flex justify-center gap-3">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
            </div>
          </div>
        )}

        {!loading && displayedGuns.length === 0 && !error && (
          <div className="state-box py-16 text-center">
            <PackageOpen size={36} className="mx-auto mb-2 text-stone-500" />
            <p className="text-stone-400">No hardware found matching your criteria.</p>
            {page > 1 && (
              <button
                type="button"
                className="btn btn--outline btn--sm mt-3"
                onClick={() => setPage(1)}
              >
                Kembali ke Halaman 1
              </button>
            )}
          </div>
        )}

        {/* Product grid */}
        {!loading && displayedGuns.length > 0 && (
          <ul className="stock">
            {displayedGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        {/* Pagination Controls (Tugas 1) */}
        {totalPages > 1 && (
          <nav
            className="pagination-bar flex items-center justify-between border-t border-stone-800 mt-8 pt-4 px-2"
            aria-label="Pagination Navigation"
          >
            <div className="text-xs text-stone-400">
              Menampilkan {Math.min(totalCount, (page - 1) * PAGE_SIZE + 1)} -{' '}
              {Math.min(totalCount, page * PAGE_SIZE)} dari {totalCount} katalog
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn--outline btn--sm p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`w-8 h-8 rounded text-xs font-semibold flex items-center justify-center transition-colors ${
                        p === page
                          ? 'bg-amber-500 text-stone-900'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </button>
                  )
                } else if (p === page - 3 || p === page + 3) {
                  return (
                    <span key={p} className="px-1 text-stone-600 text-xs">
                      …
                    </span>
                  )
                }
                return null
              })}

              <button
                type="button"
                className="btn btn--outline btn--sm p-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                aria-label="Halaman berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </nav>
        )}

        {isFallbackLocal && (
          <p className="local-notice mt-6 text-xs text-stone-500 text-center">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn text-amber-500 underline ml-1"
              onClick={() => {
                setUseLocal(false)
                refetch()
              }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Delete / Archive confirmation (Tugas 6) */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Arsipkan Hardware?"
        message={`Apakah Anda yakin ingin mengarsipkan "${deleteTarget?.name}"? Katalog ini akan dipindahkan ke tab Arsip dan disembunyikan dari katalog publik.`}
        confirmLabel="Ya, Arsipkan"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError('')
        }}
      />

      {deleteError && <div className="toast toast--error">{deleteError}</div>}
    </>
  )
}
