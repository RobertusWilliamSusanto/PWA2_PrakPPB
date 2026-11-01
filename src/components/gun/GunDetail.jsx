import { useState } from 'react'
import {
  ArrowLeft,
  Star,
  Send,
  Loader,
  Share2,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import LazyImage from '../common/LazyImage'
import {
  useReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
  useVoteReview,
} from '../../hooks/useReviews'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'
import { shareProduct, getGunShareUrl } from '../../utils/share'
import { getWhatsAppContactUrl } from '../../utils/whatsapp'

/**
 * Full-screen product detail view with multi-image carousel,
 * share button, WhatsApp contact button, and full review CRUD + votes.
 */
export default function GunDetail({ gun, onBack, onEdit, onDelete }) {
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  // Multi-image gallery state (Tugas 9)
  const images = gun.images && gun.images.length > 0 ? gun.images : [{ url: gun.image_url }]
  const [selectedImgIdx, setSelectedImgIdx] = useState(0)

  // Share & WhatsApp (Tugas 2 & 8)
  const [shareFeedback, setShareFeedback] = useState('')
  const shareUrl = getGunShareUrl(gun)
  const waUrl = getWhatsAppContactUrl(gun.seller_phone, gun, shareUrl)

  const handleShare = async () => {
    const res = await shareProduct(gun)
    setShareFeedback(res.message)
    setTimeout(() => setShareFeedback(''), 3000)
  }

  // Reviews CRUD & Votes (Tugas 7)
  const currentUserId = getUserIdentifier()
  const { reviews, setReviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const { updateReview, loading: updating } = useUpdateReview()
  const { deleteReview } = useDeleteReview()
  const { voteReview, votingId } = useVoteReview()

  // New review form state
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Edit review state
  const [editingRevId, setEditingRevId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = gun.review_count ?? reviews.length

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating harus antara 1 dan 5 bintang.')
      return
    }

    const result = await createReview(gun.id, {
      user_id: currentUserId,
      user_identifier: currentUserId,
      rating,
      comment: comment.trim(),
    })

    if (result) {
      setReviewSuccess('Review berhasil dikirim!')
      setComment('')
      setRating(5)
      refetchReviews()
      setTimeout(() => setReviewSuccess(''), 4000)
    } else {
      setReviewError('Gagal mengirim review. Server mungkin tidak merespons.')
    }
  }

  const handleStartEdit = (rev) => {
    setEditingRevId(rev.id)
    setEditRating(rev.rating)
    setEditComment(rev.comment || '')
  }

  const handleCancelEdit = () => {
    setEditingRevId(null)
    setEditComment('')
  }

  const handleSaveEdit = async (revId) => {
    if (editRating < 1 || editRating > 5) return

    const updated = await updateReview(revId, {
      rating: editRating,
      comment: editComment.trim(),
    })

    if (updated) {
      setReviews((prev) =>
        prev.map((r) =>
          r.id === revId ? { ...r, rating: editRating, comment: editComment.trim() } : r,
        ),
      )
      setEditingRevId(null)
      refetchReviews()
    }
  }

  const handleDeleteReview = async (revId) => {
    if (window.confirm('Hapus review ini secara permanen?')) {
      const ok = await deleteReview(revId)
      if (ok) {
        setReviews((prev) => prev.filter((r) => r.id !== revId))
        refetchReviews()
      }
    }
  }

  const handleVote = async (rev, value) => {
    if (votingId === rev.id) return // Debounce double-clicks

    // Optimistic UI update
    const prevVote = rev.userVote || 0
    let nextVote = 0
    let newUp = rev.upvotes || 0
    let newDown = rev.downvotes || 0

    if (prevVote === value) {
      // Toggle off
      nextVote = 0
      if (value === 1) newUp = Math.max(0, newUp - 1)
      else newDown = Math.max(0, newDown - 1)
    } else {
      // Switch or new vote
      nextVote = value
      if (value === 1) {
        newUp++
        if (prevVote === -1) newDown = Math.max(0, newDown - 1)
      } else {
        newDown++
        if (prevVote === 1) newUp = Math.max(0, newUp - 1)
      }
    }

    setReviews((prev) =>
      prev.map((r) =>
        r.id === rev.id
          ? { ...r, userVote: nextVote, upvotes: newUp, downvotes: newDown }
          : r,
      ),
    )

    try {
      await voteReview(rev.id, value)
    } catch {
      // Revert if error
      refetchReviews()
    }
  }

  const currentImg = images[selectedImgIdx]?.url || gun.image_url || '/guns/pistol.svg'

  return (
    <div className="detail max-w-4xl mx-auto py-6 px-4">
      {/* Back button */}
      <div className="flex justify-between items-center mb-6">
        <button type="button" className="detail-back flex items-center gap-2" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>

        {shareFeedback && (
          <span className="text-xs text-amber-400 bg-stone-900 border border-amber-500/40 px-3 py-1 rounded">
            {shareFeedback}
          </span>
        )}
      </div>

      {/* Hero & Multi-image carousel (Tugas 9) */}
      <div className="detail-hero grid md:grid-cols-2 gap-8 mb-8 bg-[#15191e] border border-stone-800 rounded-lg p-6">
        {/* Gallery Carousel */}
        <div className="gallery-section flex flex-col gap-3">
          <div className="relative aspect-video bg-stone-950 rounded-lg overflow-hidden flex items-center justify-center border border-stone-800">
            <LazyImage
              className="detail-img w-full h-full object-contain"
              src={currentImg}
              alt={gun.name}
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="carousel-btn prev absolute left-2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full transition-colors"
                  onClick={() =>
                    setSelectedImgIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                  }
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="carousel-btn next absolute right-2 bg-black/60 hover:bg-black/90 text-white p-2 rounded-full transition-colors"
                  onClick={() =>
                    setSelectedImgIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                  }
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`border-2 rounded overflow-hidden w-16 h-12 flex-shrink-0 transition-all ${
                    idx === selectedImgIdx
                      ? 'border-amber-500 scale-105'
                      : 'border-stone-700 opacity-60 hover:opacity-100'
                  }`}
                  onClick={() => setSelectedImgIdx(idx)}
                >
                  <img
                    src={img.url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info & Actions */}
        <div className="detail-info flex flex-col justify-between">
          <div>
            <h1 className="display text-3xl font-bold text-stone-100 mb-2">{gun.name}</h1>
            <p className="type text-stone-400 mb-2">
              {category}
              {caliber ? ` · ${caliber}` : ''}
            </p>
            <p className="price detail-price text-2xl font-bold text-amber-400 mb-3">
              {formatPrice(price)}
            </p>

            {avgRating > 0 && (
              <p className="detail-rating flex items-center gap-1.5 text-stone-300 text-sm mb-4">
                <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
                <span className="font-semibold">{avgRating.toFixed(1)}</span>
                <span className="text-stone-500">
                  ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
                </span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="detail-actions flex flex-wrap gap-2.5 pt-4 border-t border-stone-800">
            {/* WhatsApp Contact Seller (Tugas 8) */}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--primary flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
                title="Hubungi Penjual di WhatsApp"
              >
                <MessageCircle size={16} /> Hubungi Penjual
              </a>
            )}

            {/* Share Link (Tugas 2) */}
            <button
              type="button"
              className="btn btn--outline flex items-center gap-1.5"
              onClick={handleShare}
              title="Bagikan Tautan Publik"
            >
              <Share2 size={16} /> Bagikan
            </button>

            <FavoriteButton gunId={gun.id || gun.name} />

            {onEdit && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => onEdit(gun)}
              >
                Edit
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => onDelete(gun)}
              >
                Arsipkan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section mb-6 bg-[#15191e] border border-stone-800 rounded-lg p-6">
        <h2 className="text-lg font-bold text-stone-200 mb-3">Description</h2>
        <p className="text-stone-300 leading-relaxed whitespace-pre-line">
          {gun.description || 'No description available.'}
        </p>
      </section>

      {/* Specifications */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section mb-6 bg-[#15191e] border border-stone-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-stone-200 mb-3">Specifications</h2>
          <ul className="detail-specs grid sm:grid-cols-2 gap-2 text-sm text-stone-300">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i} className="p-2 bg-stone-900/60 rounded border border-stone-800">
                <strong className="text-stone-200">{ing.name}:</strong> {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reviews Section with Full CRUD & Thumbs Up/Down (Tugas 7) */}
      <section className="detail-section bg-[#15191e] border border-stone-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-stone-100 mb-4">Reviews & Ratings</h2>

        {/* Submit Review Form */}
        <form className="review-form mb-8 p-4 bg-stone-900/60 border border-stone-800 rounded" onSubmit={handleSubmitReview}>
          <div className="review-stars flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn p-1"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
            <span className="text-xs text-stone-400 ml-2">({rating} dari 5 bintang)</span>
          </div>

          <textarea
            className="review-input w-full p-3 bg-stone-900 border border-stone-700 rounded text-stone-100 mb-3 focus:outline-none focus:border-amber-500 text-sm"
            rows="3"
            placeholder="Tulis ulasan tentang spesifikasi, handling, atau performa hardware ini…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary flex items-center gap-2"
            disabled={submitting || !gun.id}
          >
            {submitting ? (
              <>
                <Loader size={16} className="spin" /> Mengirim…
              </>
            ) : (
              <>
                <Send size={16} /> Kirim Review
              </>
            )}
          </button>

          {reviewError && <p className="form-error text-red-400 text-xs mt-2">{reviewError}</p>}
          {reviewSuccess && <p className="form-success text-emerald-400 text-xs mt-2">{reviewSuccess}</p>}
        </form>

        {/* Existing Reviews List */}
        {reviewsLoading ? (
          <p className="detail-loading text-stone-400 text-sm py-4">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list divide-y divide-stone-800">
            {reviews.map((rev) => {
              const isOwner = rev.is_owner || rev.user_id === currentUserId
              const isEditing = editingRevId === rev.id

              return (
                <li key={rev.id} className="py-4">
                  {isEditing ? (
                    /* Inline Edit Form for Review */
                    <div className="bg-stone-900 p-4 rounded border border-stone-700 space-y-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="p-1"
                            onClick={() => setEditRating(n)}
                          >
                            <Star
                              size={18}
                              fill={n <= editRating ? 'var(--brass)' : 'none'}
                              stroke={n <= editRating ? 'var(--brass)' : 'var(--steel)'}
                            />
                          </button>
                        ))}
                      </div>

                      <textarea
                        className="w-full p-2 bg-stone-950 border border-stone-700 rounded text-stone-100 text-sm"
                        rows="2"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                      />

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          className="btn btn--outline btn--sm flex items-center gap-1"
                          onClick={handleCancelEdit}
                        >
                          <X size={14} /> Batal
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm flex items-center gap-1"
                          disabled={updating}
                          onClick={() => handleSaveEdit(rev.id)}
                        >
                          <Check size={14} /> Simpan
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Review Item */
                    <div>
                      <div className="review-head flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="review-user font-semibold text-stone-200 text-sm">
                            {rev.user_identifier}
                          </span>
                          {isOwner && (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
                              Pemilik
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="review-stars-display flex">
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                size={14}
                                fill={i < rev.rating ? 'var(--brass)' : 'none'}
                                stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                              />
                            ))}
                          </span>

                          {/* Owner actions: Edit & Delete */}
                          {isOwner && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1 text-stone-400 hover:text-stone-200"
                                onClick={() => handleStartEdit(rev)}
                                title="Edit review"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="p-1 text-red-400 hover:text-red-300"
                                onClick={() => handleDeleteReview(rev.id)}
                                title="Hapus review"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {rev.comment && (
                        <p className="review-comment text-stone-300 text-sm mt-1 leading-relaxed">
                          {rev.comment}
                        </p>
                      )}

                      {/* Thumbs Up / Down Voting Controls (Tugas 7) */}
                      <div className="flex items-center gap-4 mt-3">
                        <button
                          type="button"
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors ${
                            rev.userVote === 1
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                          }`}
                          onClick={() => handleVote(rev, 1)}
                          disabled={votingId === rev.id}
                          title="Bermanfaat (Thumbs Up)"
                        >
                          <ThumbsUp size={13} fill={rev.userVote === 1 ? 'currentColor' : 'none'} />
                          <span>{rev.upvotes || 0}</span>
                        </button>

                        <button
                          type="button"
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors ${
                            rev.userVote === -1
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                              : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                          }`}
                          onClick={() => handleVote(rev, -1)}
                          disabled={votingId === rev.id}
                          title="Kurang bermanfaat (Thumbs Down)"
                        >
                          <ThumbsDown
                            size={13}
                            fill={rev.userVote === -1 ? 'currentColor' : 'none'}
                          />
                          <span>{rev.downvotes || 0}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty text-stone-400 text-sm py-4">
            No reviews yet. Be the first to review this hardware!
          </p>
        )}
      </section>
    </div>
  )
}
