import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, RotateCcw, Trash2, Loader, Archive } from 'lucide-react'
import gunService from '../services/gunService'
import ConfirmModal from '../components/modals/ConfirmModal'
import { formatPrice } from '../utils/helpers'
import LazyImage from '../components/common/LazyImage'

export default function ArchivePage({ onBack, onRestored }) {
  const [archivedGuns, setArchivedGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  // Permanent delete modal
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchArchived = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await gunService.getArchivedGuns({ limit: 100 })
      if (res.success) {
        setArchivedGuns(res.data || [])
      } else {
        setError('Gagal memuat katalog yang diarsipkan.')
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat memuat arsip.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArchived()
  }, [fetchArchived])

  const handleRestore = async (gun) => {
    try {
      setActionError('')
      setActionSuccess('')
      await gunService.restoreGun(gun.id)
      setActionSuccess(`"${gun.name}" berhasil dipulihkan ke katalog publik!`)
      setArchivedGuns((prev) => prev.filter((item) => item.id !== gun.id))
      if (onRestored) onRestored(gun)
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (err) {
      setActionError(err.message || 'Gagal memulihkan katalog.')
    }
  }

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setActionError('')
      setActionSuccess('')
      await gunService.permanentDeleteGun(deleteTarget.id)
      setActionSuccess(`"${deleteTarget.name}" berhasil dihapus permanen.`)
      setArchivedGuns((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (err) {
      setActionError(err.message || 'Gagal menghapus secara permanen.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="archive-page max-w-5xl mx-auto py-8 px-4">
      <button type="button" className="detail-back mb-6 flex items-center gap-2" onClick={onBack}>
        <ArrowLeft size={18} /> Kembali
      </button>

      <section className="masthead mb-6">
        <div className="flex items-center gap-3">
          <Archive size={28} className="text-amber-500" />
          <h1 className="display text-3xl font-bold">Arsip Katalog Hardware</h1>
        </div>
        <p className="lede text-stone-400 mt-1">
          Katalog yang dihapus masuk ke arsip ini dan tidak dapat dilihat oleh publik. Anda dapat
          memulihkannya (Restore) kembali ke katalog publik atau menghapusnya secara permanen.
        </p>
      </section>

      {actionSuccess && (
        <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded text-sm">
          {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-sm">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 flex flex-col items-center justify-center">
          <Loader size={36} className="spin text-brass mb-3" />
          <p className="text-stone-400">Memuat katalog terarsip…</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-950/40 border border-red-800 rounded text-center">
          <p className="text-red-300">{error}</p>
        </div>
      ) : archivedGuns.length === 0 ? (
        <div className="bg-[#15191e] border border-stone-800 rounded-lg p-12 text-center">
          <Archive size={40} className="mx-auto mb-3 text-stone-600" />
          <h3 className="text-lg font-bold text-stone-300 mb-1">Arsip Kosong</h3>
          <p className="text-stone-500 text-sm">
            Tidak ada katalog yang sedang diarsipkan. Semua item aktif berada di katalog publik.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {archivedGuns.map((gun) => (
            <div
              key={gun.id}
              className="bg-[#15191e] border border-stone-800 rounded-lg overflow-hidden flex flex-col"
            >
              <div className="relative aspect-video bg-stone-900">
                <LazyImage
                  src={gun.image_url}
                  alt={gun.name}
                  className="w-full h-full object-cover opacity-80"
                />
                <span className="absolute top-2 right-2 bg-stone-900/90 text-amber-400 text-xs px-2 py-0.5 rounded border border-amber-500/30">
                  Archived
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-stone-200 text-lg mb-1">{gun.name}</h3>
                  <p className="text-xs text-stone-400 mb-2">
                    {gun.type} · {gun.caliber}
                  </p>
                  <p className="text-sm font-semibold text-amber-400 mb-4">
                    {formatPrice(gun.price)}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    className="btn btn--outline btn--sm flex-1 flex items-center justify-center gap-1.5 text-xs text-emerald-400 border-emerald-900 hover:bg-emerald-950/40"
                    onClick={() => handleRestore(gun)}
                    title="Pulihkan ke katalog publik"
                  >
                    <RotateCcw size={14} /> Pulihkan
                  </button>

                  <button
                    type="button"
                    className="btn btn--danger btn--sm flex items-center justify-center gap-1.5 text-xs"
                    onClick={() => setDeleteTarget(gun)}
                    title="Hapus permanen dari database"
                  >
                    <Trash2 size={14} /> Hapus Permanen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Permanent Delete */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Permanen?"
        message={`Apakah Anda yakin ingin menghapus "${deleteTarget?.name}" secara permanen? Data yang dihapus tidak dapat dipulihkan kembali.`}
        confirmText="Ya, Hapus Permanen"
        cancelText="Batal"
        isDanger={true}
        isLoading={deleting}
        onConfirm={handlePermanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
