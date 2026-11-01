// ---------------------------------------------------------------------------
// Share Link Utility (Web Share API with Clipboard Fallback)
// ---------------------------------------------------------------------------

/**
 * Build a canonical public share URL using the gun's unique share_token
 */
export function getGunShareUrl(gun) {
  if (!gun) return ''
  const token = gun.share_token || `bb_${gun.id}`
  const base = window.location.origin + window.location.pathname
  return `${base}?share=${encodeURIComponent(token)}`
}

/**
 * Share product link using Web Share API or copy-to-clipboard fallback.
 * @param {Object} gun
 * @returns {Promise<{ success: boolean, method: 'native' | 'clipboard', message: string }>}
 */
export async function shareProduct(gun) {
  const url = getGunShareUrl(gun)
  const title = gun.name || 'Hardware Piece'
  const text = `Lihat spesifikasi ${title} di katalog Bore & Barrel:`

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return { success: true, method: 'native', message: 'Tautan berhasil dibagikan!' }
    } catch (err) {
      // AbortError happens when user dismisses the native dialog; ignore or fallback to clipboard
      if (err.name === 'AbortError') {
        return { success: false, method: 'native', message: 'Pembagian dibatalkan.' }
      }
    }
  }

  // Fallback to Clipboard API
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url)
      return { success: true, method: 'clipboard', message: 'Tautan disalin ke clipboard!' }
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return { success: true, method: 'clipboard', message: 'Tautan disalin ke clipboard!' }
    }
  } catch {
    return { success: false, method: 'clipboard', message: 'Gagal menyalin tautan.' }
  }
}
