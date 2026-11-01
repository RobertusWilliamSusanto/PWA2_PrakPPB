import axios from 'axios'
import { BASE_URL, SUPABASE_KEY, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// UploadService — multi-image upload service with validation & fallback.
// Allowed: jpg, jpeg, png, webp. Max: 5 MB.
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

class UploadService {
  /**
   * Validate a single image file.
   */
  validateFile(file) {
    if (!file) throw new Error('No file provided.')
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Tipe file tidak valid (${file.name}). Format yang didukung: .jpg, .jpeg, .png, .webp`)
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(`Ukuran file melebihi batas 5MB (${file.name}).`)
    }
    return true
  }

  /**
   * Upload a single image file.
   * @param {File} file
   * @returns {Promise<{ success: boolean, data: { url: string, filename: string } }>}
   */
  async uploadImage(file) {
    this.validateFile(file)

    // --- Supabase Storage flow ---
    if (IS_SUPABASE) {
      const ext = file.name.split('.').pop() || 'png'
      const fileName = `gun_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
      const bucketName = 'product-images'

      try {
        const uploadUrl = `${BASE_URL}/storage/v1/object/${bucketName}/${fileName}`
        await axios.post(uploadUrl, file, {
          headers: {
            'Content-Type': file.type,
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          timeout: 30000,
        })

        const publicUrl = `${BASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`
        return {
          success: true,
          data: { url: publicUrl, filename: fileName },
        }
      } catch (err) {
        console.warn('Supabase bucket upload not accessible, creating base64 data URL:', err)
        // Read file as base64 Data URL so the image displays and persists
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        return {
          success: true,
          data: { url: dataUrl, filename: file.name },
        }
      }
    }

    // --- University API flow (/api/v1/upload) ---
    const formData = new FormData()
    formData.append('image', file)

    const response = await axios.post(`${BASE_URL}/api/v1/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })

    return response.data
  }

  /**
   * Upload multiple images concurrently with validation.
   * @param {FileList|File[]} files
   * @returns {Promise<Array<{ url: string, filename: string }>>}
   */
  async uploadMultipleImages(files) {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return []

    // Validate all files first before uploading
    for (const file of fileArray) {
      this.validateFile(file)
    }

    const uploadPromises = fileArray.map(async (file) => {
      const res = await this.uploadImage(file)
      return res.data
    })

    return Promise.all(uploadPromises)
  }
}

export default new UploadService()
