// ---------------------------------------------------------------------------
// WhatsApp Helper for Contacting Seller
// ---------------------------------------------------------------------------

/**
 * Normalizes an Indonesian phone number to E.164 format without '+'
 * e.g. 0812-3456-7890 -> 6281234567890
 * @param {string} phone
 * @returns {string} normalized number or empty string
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return ''

  // Remove non-digit characters
  let cleaned = phone.replace(/\D/g, '')

  if (!cleaned) return ''

  // If starts with 08..., replace leading 0 with 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned
  }

  return cleaned
}

/**
 * Generates a WhatsApp click-to-chat URL with pre-filled message
 * @param {string} phone - Seller's phone number
 * @param {Object} gun - Catalog product details
 * @param {string} [shareUrl] - Public shareable link
 * @returns {string|null} WhatsApp URL or null if phone is empty
 */
export function getWhatsAppContactUrl(phone, gun, shareUrl = '') {
  const normalized = normalizePhoneNumber(phone || gun?.seller_phone || gun?.contact_phone)
  if (!normalized) return null

  const productName = gun?.name || 'Hardware Piece'
  const productPrice = gun?.price ? ` (Rp ${gun.price.toLocaleString('id-ID')})` : ''

  let text = `Halo, saya tertarik dengan item "${productName}"${productPrice} yang ada di katalog Bore & Barrel.`
  if (shareUrl) {
    text += `\n\nLink produk: ${shareUrl}`
  }

  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
}
