import { useState } from 'react'
import { Share2, MessageCircle, Check } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import LazyImage from '../common/LazyImage'
import { formatPrice, truncate } from '../../utils/helpers'
import { shareProduct, getGunShareUrl } from '../../utils/share'
import { getWhatsAppContactUrl } from '../../utils/whatsapp'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked (admin)
 * @param {Function} [props.onDelete]— called when Delete is clicked (admin)
 */
export default function GunCard({ gun, onSelect, onEdit, onDelete }) {
  const [shareToast, setShareToast] = useState('')
  const imgSrc = gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  const shareUrl = getGunShareUrl(gun)
  const waUrl = getWhatsAppContactUrl(gun.seller_phone, gun, shareUrl)

  const handleShareClick = async (e) => {
    e.stopPropagation()
    const res = await shareProduct(gun)
    setShareToast(res.message || 'Link copied!')
    setTimeout(() => setShareToast(''), 2500)
  }

  return (
    <li className="card relative group">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <div className="card-img-container aspect-video w-full overflow-hidden bg-stone-900 rounded">
          <LazyImage
            className="card-img"
            src={imgSrc}
            alt={gun.name}
            width="240"
            height="180"
          />
        </div>

        <span className="name display text-left">{gun.name}</span>

        <span className="type text-left">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc text-left">{truncate(gun.description, 72)}</span>
        )}

        <span className="price text-left">{formatPrice(price)}</span>
      </button>

      {/* Toast feedback */}
      {shareToast && (
        <div className="absolute top-2 left-2 right-2 z-20 bg-stone-900/95 border border-amber-500/40 text-amber-300 text-xs py-1 px-2 rounded text-center flex items-center justify-center gap-1 shadow-lg">
          <Check size={12} /> {shareToast}
        </div>
      )}

      {/* Floating actions row */}
      <div className="card-actions">
        {/* WhatsApp Seller button (Tugas 8) */}
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="card-act-btn text-emerald-400 hover:text-emerald-300"
            onClick={(e) => e.stopPropagation()}
            aria-label="Hubungi Penjual via WhatsApp"
            title="Hubungi Penjual (WhatsApp)"
          >
            <MessageCircle size={16} />
          </a>
        )}

        {/* Share Button (Tugas 2) */}
        <button
          type="button"
          className="card-act-btn"
          onClick={handleShareClick}
          aria-label={`Share ${gun.name}`}
          title="Share Link"
        >
          <Share2 size={16} />
        </button>

        <FavoriteButton gunId={gun.id || gun.name} />

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(gun)
            }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(gun)
            }}
            aria-label={`Delete ${gun.name}`}
            title="Arsipkan / Delete"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
