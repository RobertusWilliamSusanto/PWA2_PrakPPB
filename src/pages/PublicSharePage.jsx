import { useState, useEffect } from 'react'
import { ArrowLeft, Star, Share2, MessageCircle, AlertTriangle, Loader, ChevronLeft, ChevronRight } from 'lucide-react'
import gunService from '../services/gunService'
import reviewService from '../services/reviewService'
import LazyImage from '../components/common/LazyImage'
import { formatPrice } from '../utils/helpers'
import { shareProduct, getGunShareUrl } from '../utils/share'
import { getWhatsAppContactUrl } from '../utils/whatsapp'

export default function PublicSharePage({ token, onGoHome }) {
  const [loading, setLoading] = useState(true)
  const [gun, setGun] = useState(null)
  const [isArchived, setIsArchived] = useState(false)
  const [error, setError] = useState(null)
  const [reviews, setReviews] = useState([])
  const [selectedImgIdx, setSelectedImgIdx] = useState(0)
  const [shareFeedback, setShareFeedback] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        const res = await gunService.getGunByShareToken(token)
        if (res.success && res.data) {
          setGun(res.data)
          setIsArchived(Boolean(res.isArchived || res.data.deleted_at))

          // Load reviews read-only
          try {
            const revRes = await reviewService.getReviews(res.data.id)
            if (revRes.success) setReviews(revRes.data || [])
          } catch {
            /* ignore */
          }
        } else {
          setError('Item tidak ditemukan.')
        }
      } catch (err) {
        setError(err.message || 'Gagal memuat katalog.')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadData()
    } else {
      setError('Token share tidak valid.')
      setLoading(false)
    }
  }, [token])

  const handleShare = async () => {
    if (!gun) return
    const result = await shareProduct(gun)
    setShareFeedback(result.message)
    setTimeout(() => setShareFeedback(''), 3000)
  }

  if (loading) {
    return (
      <div className="share-loading p-12 text-center flex flex-col items-center justify-center min-h-[50vh]">
        <Loader size={36} className="spin text-brass mb-4" />
        <p className="text-steel">Memuat data spesifikasi hardware…</p>
      </div>
    )
  }

  // Archived or soft-deleted item
  if (isArchived) {
    return (
      <div className="share-empty p-8 text-center max-w-lg mx-auto min-h-[50vh] flex flex-col items-center justify-center">
        <AlertTriangle size={48} className="text-brass mb-4" />
        <h2 className="display text-2xl font-bold mb-2">Item Telah Diarsipkan</h2>
        <p className="text-steel mb-6">
          Katalog ini telah diarsipkan oleh pemiliknya dan tidak lagi dapat diakses secara publik.
        </p>
        <button type="button" className="btn btn--primary" onClick={onGoHome}>
          <ArrowLeft size={16} /> Lihat Katalog Tersedia
        </button>
      </div>
    )
  }

  if (error || !gun) {
    return (
      <div className="share-empty p-8 text-center max-w-lg mx-auto min-h-[50vh] flex flex-col items-center justify-center">
        <AlertTriangle size={48} className="text-red-400 mb-4" />
        <h2 className="display text-2xl font-bold mb-2">Hardware Tidak Ditemukan</h2>
        <p className="text-steel mb-6">
          {error || 'Tautan share salah atau produk sudah dihapus permanen.'}
        </p>
        <button type="button" className="btn btn--primary" onClick={onGoHome}>
          <ArrowLeft size={16} /> Kembali ke Beranda
        </button>
      </div>
    )
  }

  const images = gun.images && gun.images.length > 0 ? gun.images : [{ url: gun.image_url }]
  const currentImg = images[selectedImgIdx]?.url || gun.image_url || '/guns/pistol.svg'
  const waUrl = getWhatsAppContactUrl(gun.seller_phone, gun, getGunShareUrl(gun))

  return (
    <div className="public-share-page max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6 flex justify-between items-center">
        <button type="button" className="detail-back flex items-center gap-2" onClick={onGoHome}>
          <ArrowLeft size={18} /> Jelajahi Semua Katalog
        </button>
        <span className="badge badge--public bg-stone-800 text-stone-300 px-3 py-1 text-xs rounded uppercase tracking-wider">
          Public Share View
        </span>
      </div>

      <div className="detail-hero grid md:grid-cols-2 gap-8 mb-8 bg-[#15191e] border border-stone-800 rounded-lg p-6">
        {/* Multi-Image Gallery */}
        <div className="gallery-section flex flex-col gap-3">
          <div className="relative aspect-video bg-black/40 rounded overflow-hidden flex items-center justify-center">
            <LazyImage
              src={currentImg}
              alt={gun.name}
              className="w-full h-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="carousel-btn prev absolute left-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full"
                  onClick={() => setSelectedImgIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="carousel-btn next absolute right-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full"
                  onClick={() => setSelectedImgIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`border-2 rounded overflow-hidden w-16 h-12 flex-shrink-0 ${
                    idx === selectedImgIdx ? 'border-amber-500' : 'border-stone-700 opacity-60'
                  }`}
                  onClick={() => setSelectedImgIdx(idx)}
                >
                  <img src={img.url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info & Actions */}
        <div className="detail-info flex flex-col justify-between">
          <div>
            <h1 className="display text-3xl font-bold mb-2 text-stone-100">{gun.name}</h1>
            <p className="type text-stone-400 mb-2">
              {gun.type || gun.category} {gun.caliber ? `· ${gun.caliber}` : ''}
            </p>
            <p className="price text-2xl font-bold text-amber-400 mb-4">{formatPrice(gun.price)}</p>

            <div className="specs mb-4 text-sm text-stone-300">
              <h3 className="font-semibold text-stone-200 mb-1">Spesifikasi:</h3>
              <ul className="list-disc pl-5 space-y-1">
                {gun.ingredients && gun.ingredients.length > 0 ? (
                  gun.ingredients.map((spec, i) => (
                    <li key={i}>
                      <strong>{spec.name}:</strong> {spec.quantity}
                    </li>
                  ))
                ) : (
                  <li>Kaliber: {gun.caliber || 'Standard'}</li>
                )}
              </ul>
            </div>
          </div>

          <div className="actions flex flex-col sm:flex-row gap-3 pt-4 border-t border-stone-800">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--primary flex items-center justify-center gap-2 flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <MessageCircle size={18} /> Hubungi Penjual
              </a>
            )}

            <button
              type="button"
              className="btn btn--outline flex items-center justify-center gap-2"
              onClick={handleShare}
            >
              <Share2 size={18} /> {shareFeedback || 'Bagikan'}
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-[#15191e] border border-stone-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-3 text-stone-200">Deskripsi Produk</h2>
        <p className="text-stone-300 leading-relaxed whitespace-pre-line">
          {gun.description || 'Tidak ada deskripsi tambahan.'}
        </p>
      </div>

      {/* Read-Only Reviews */}
      <div className="bg-[#15191e] border border-stone-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-stone-200 flex items-center gap-2">
          Ulasan Pembeli ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-stone-400 text-sm">Belum ada ulasan untuk produk ini.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-stone-800 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-stone-300 text-sm">{r.user_identifier}</span>
                  <div className="flex text-amber-400">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        fill={i < r.rating ? 'currentColor' : 'none'}
                        stroke="currentColor"
                      />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm text-stone-400">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
