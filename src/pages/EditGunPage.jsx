import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

/**
 * EditGunPage — Edit an existing weapon / hardware item.
 * Supports updating specs, steps, image replacement, and draft management.
 */
export default function EditGunPage({ gun, gunId, onBack, onSuccess }) {
  const targetId = gunId || gun?.id

  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan',
    difficulty: 'mudah',
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
    seller_phone: '',
  })

  const [imagesList, setImagesList] = useState([])
  const [currentImageUrl, setCurrentImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Specs & Steps
  const [specs, setSpecs] = useState([{ name: '', quantity: '' }])
  const [steps, setSteps] = useState([''])

  // Draft modal
  const [showDraftModal, setShowDraftModal] = useState(() => (targetId ? hasDraft(targetId) : false))
  const [draftTimestamp, setDraftTimestamp] = useState(() => (targetId ? getDraftTimestamp(targetId) : null))

  // Fetch initial data
  useEffect(() => {
    const fetchGun = async () => {
      try {
        setLoading(true)
        setError('')

        // If gun was passed directly and has full details, use it; else fetch from API
        let data = gun
        if (!data || !data.ingredients || !data.steps) {
          if (targetId && !String(targetId).startsWith('local-')) {
            const res = await gunService.getGunById(targetId)
            if (res.success && res.data) {
              data = res.data
            }
          }
        }

        if (data) {
          setFormData({
            name: data.name || '',
            type: data.type || (data.category === 'makanan' ? 'Pistol' : 'Rifle'),
            caliber: data.caliber || '9mm',
            category: data.category || 'makanan',
            difficulty: data.difficulty || 'mudah',
            price: data.price ?? data.cook_time ?? 599,
            description: data.description || '',
            servings: data.servings || 1,
            is_featured: Boolean(data.is_featured),
            seller_phone: data.seller_phone || '',
          })
          const loadedImgs = Array.isArray(data.images) && data.images.length > 0
            ? data.images
            : [{ url: data.image_url || data.image || '/guns/pistol.svg', is_primary: true }]
          setImagesList(loadedImgs)
          setCurrentImageUrl(loadedImgs[0]?.url || data.image_url || data.image || '/guns/pistol.svg')

          if (data.ingredients && data.ingredients.length > 0) {
            setSpecs(data.ingredients.map((ing) => ({
              name: ing.name || '',
              quantity: ing.quantity || '',
            })))
          } else {
            setSpecs([
              { name: 'Platform', quantity: data.type || 'Pistol' },
              { name: 'Caliber', quantity: data.caliber || '9mm' },
            ])
          }

          if (data.steps && data.steps.length > 0) {
            setSteps(data.steps.map((st) => (typeof st === 'string' ? st : st.instruction || '')))
          } else {
            setSteps(['Standard manufacturer maintenance and cleaning protocol.'])
          }

        } else {
          setError('Hardware record could not be loaded.')
        }
      } catch (err) {
        setError(err.message || 'Failed to load hardware record from server.')
      } finally {
        setLoading(false)
      }
    }

    if (targetId) {
      fetchGun()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  // Draft operations
  const handleLoadDraft = () => {
    const draft = loadDraft(targetId)
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (draft.imagePreview) {
        setImagePreview(draft.imagePreview)
      }
      setShowDraftModal(false)
      setSuccessMsg('Saved draft restored.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft(targetId)
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  const handleManualSaveDraft = () => {
    const draftData = {
      formData,
      specs,
      steps,
      imagePreview: imagePreview || currentImageUrl,
    }
    const saved = saveDraft(draftData, targetId)
    if (saved) {
      const ts = getDraftTimestamp(targetId)
      setDraftTimestamp(ts)
      setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  // Handle multi-image file selection & upload (Tugas 9)
  const handleMultipleImages = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`File ${file.name} melebihi batas 5MB.`)
        return
      }
      if (!allowed.includes(file.type)) {
        setError(`File ${file.name} bukan format yang didukung (.jpg, .png, .webp).`)
        return
      }
    }

    try {
      setUploading(true)
      setError('')
      const uploaded = await uploadService.uploadMultipleImages(files)
      setImagesList((prev) => {
        const next = [
          ...prev,
          ...uploaded.map((u, i) => ({
            url: u.url,
            is_primary: prev.length === 0 && i === 0,
          })),
        ]
        if (next.length > 0) {
          setCurrentImageUrl(next[0].url)
        }
        return next
      })
      setSuccessMsg('Foto berhasil ditambahkan.')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setError(err.message || 'Gagal mengupload gambar.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (idx) => {
    setImagesList((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (next.length > 0 && !next.some((img) => img.is_primary)) {
        next[0].is_primary = true
      }
      setCurrentImageUrl(next[0]?.url || '')
      return next
    })
  }

  const handleSetPrimary = (idx) => {
    setImagesList((prev) => {
      const target = prev[idx]
      const remaining = prev.filter((_, i) => i !== idx)
      const next = [{ ...target, is_primary: true }, ...remaining.map((r) => ({ ...r, is_primary: false }))]
      setCurrentImageUrl(next[0].url)
      return next
    })
  }

  const handleMoveImage = (idx, dir) => {
    setImagesList((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(idx, 1)
      copy.splice(newIdx, 0, moved)
      copy.forEach((c, i) => {
        c.is_primary = i === 0
      })
      setCurrentImageUrl(copy[0].url)
      return copy
    })
  }

  const handleImageChange = (e) => {
    handleMultipleImages(e)
  }

  // Specs & Steps
  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => setSteps((prev) => [...prev, ''])
  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit update
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps
      .filter((s) => s.trim())
      .map((s) => s.trim())

    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance step.')
      return
    }

    const primaryImg = imagesList[0]?.url || currentImageUrl || '/guns/pistol.svg'
    const payload = {
      name: formData.name.trim(),
      type: formData.type || (formData.category === 'minuman' ? 'Rifle' : 'Pistol'),
      caliber: formData.caliber || '9mm',
      price: Number(formData.price) || 500,
      category: formData.category || 'makanan',
      description: formData.description.trim() || `${formData.type} caliber ${formData.caliber}.`,
      image_url: primaryImg,
      images: imagesList.length > 0 ? imagesList : [{ url: primaryImg, display_order: 0, is_primary: true }],
      seller_phone: formData.seller_phone || '081234567890',
      prep_time: 15,
      cook_time: Number(formData.price) || 500,
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setUpdating(true)
      const res = await gunService.updateGun(targetId, payload)
      if (res.success || res.data) {
        deleteDraft(targetId)
        if (onSuccess) {
          onSuccess(res.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(res.message || 'Failed to update record on server.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while updating record.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="state-box">
        <Loader size={32} className="spin" />
        <p>Loading hardware details for editing…</p>
      </div>
    )
  }

  return (
    <div className="form-page">
      {/* Head */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={handleManualSaveDraft}
          title="Save draft"
        >
          <Save size={14} /> Save Draft
        </button>
      </div>

      <div className="form-title-group">
        <h1 className="display">Modify Hardware Record</h1>
        <p className="lede">
          Updating record ID: <code className="mono-badge">{targetId}</code>
        </p>
      </div>

      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="entry-form">
        {/* Imagery Section (Tugas 9) */}
        <div className="card-box">
          <h2 className="card-box-title">Multi-Gambar Katalog</h2>
          <p className="card-box-desc">
            Kelola foto hardware. Gambar pertama (#1) otomatis menjadi thumbnail / primary image katalog.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imagesList.map((img, idx) => {
                const url = typeof img === 'string' ? img : img.url
                return (
                  <div
                    key={idx}
                    className={`relative rounded border-2 overflow-hidden bg-stone-900 aspect-video flex items-center justify-center ${
                      idx === 0 ? 'border-amber-500' : 'border-stone-700'
                    }`}
                  >
                    <img src={url} alt={`Hardware ${idx + 1}`} className="w-full h-full object-contain" />
                    <span
                      className={`absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded ${
                        idx === 0 ? 'bg-amber-500 text-stone-900 font-bold' : 'bg-stone-900/80 text-stone-300'
                      }`}
                    >
                      {idx === 0 ? 'Thumbnail' : `#${idx + 1}`}
                    </span>

                    <div className="absolute bottom-1 right-1 flex gap-1">
                      {idx > 0 && (
                        <button
                          type="button"
                          className="p-1 bg-black/70 hover:bg-black text-xs rounded text-stone-200"
                          onClick={() => handleSetPrimary(idx)}
                          title="Jadikan Thumbnail"
                        >
                          ★
                        </button>
                      )}
                      {idx > 0 && (
                        <button
                          type="button"
                          className="p-1 bg-black/70 hover:bg-black text-xs rounded text-stone-200"
                          onClick={() => handleMoveImage(idx, -1)}
                          title="Pindah ke kiri"
                        >
                          ◀
                        </button>
                      )}
                      {idx < imagesList.length - 1 && (
                        <button
                          type="button"
                          className="p-1 bg-black/70 hover:bg-black text-xs rounded text-stone-200"
                          onClick={() => handleMoveImage(idx, 1)}
                          title="Pindah ke kanan"
                        >
                          ▶
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-1 bg-red-900/80 hover:bg-red-700 text-xs rounded text-white"
                        onClick={() => handleRemoveImage(idx)}
                        title="Hapus gambar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-2">
              <label htmlFor="edit-gun-image" className="btn btn--outline btn--sm cursor-pointer inline-flex items-center gap-1.5">
                <Upload size={14} /> Tambah Foto (JPG, PNG, WebP &le; 5MB)
              </label>
              <input
                id="edit-gun-image"
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
              {uploading && <span className="text-xs text-amber-400 ml-2">Mengunggah…</span>}
            </div>
          </div>
        </div>

        {/* Core fields */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">
              Model Designation <span className="req">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-type" className="form-label">
              Platform / Category <span className="req">*</span>
            </label>
            <select
              id="edit-type"
              name="type"
              value={formData.type}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  type: e.target.value,
                  category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                }))
              }
              className="form-select"
            >
              <option value="Pistol">Pistol (Sidearm)</option>
              <option value="Rifle">Rifle (Long Gun)</option>
              <option value="Shotgun">Shotgun (Smoothbore)</option>
              <option value="Submachine Gun">Submachine Gun</option>
            </select>
          </div>
        </div>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label htmlFor="edit-caliber" className="form-label">
              Caliber / Chambering <span className="req">*</span>
            </label>
            <input
              id="edit-caliber"
              type="text"
              name="caliber"
              value={formData.caliber}
              onChange={(e) => setFormData((p) => ({ ...p, caliber: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-price" className="form-label">
              Price (USD) <span className="req">*</span>
            </label>
            <input
              id="edit-price"
              type="number"
              name="price"
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
              className="form-input"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-difficulty" className="form-label">
              Grade / Build Quality <span className="req">*</span>
            </label>
            <select
              id="edit-difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={(e) => setFormData((p) => ({ ...p, difficulty: e.target.value }))}
              className="form-select"
            >
              <option value="mudah">Commercial / Standard</option>
              <option value="sedang">Mil-Spec / Service Issue</option>
              <option value="sulit">Match Grade / Custom</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-desc" className="form-label">
            Armory Description
          </label>
          <textarea
            id="edit-desc"
            name="description"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="form-textarea"
          />
        </div>

        <div className="form-group">
          <label htmlFor="edit-seller-phone" className="form-label">
            Nomor WhatsApp Penjual
          </label>
          <input
            id="edit-seller-phone"
            type="tel"
            name="seller_phone"
            value={formData.seller_phone}
            onChange={(e) => setFormData((p) => ({ ...p, seller_phone: e.target.value }))}
            placeholder="e.g. 081234567890"
            className="form-input"
          />
        </div>

        {/* Specs */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Specifications &amp; Components</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addSpec}>
              <Plus size={14} /> Add Spec
            </button>
          </div>
          <div className="multi-rows">
            {specs.map((spec, i) => (
              <div key={i} className="multi-row">
                <input
                  type="text"
                  placeholder="Attribute"
                  value={spec.name}
                  onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                  className="form-input"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={spec.quantity}
                  onChange={(e) => handleSpecChange(i, 'quantity', e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeSpec(i)}
                  disabled={specs.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Assembly &amp; Maintenance Protocol</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addStep}>
              <Plus size={14} /> Add Step
            </button>
          </div>
          <div className="multi-rows">
            {steps.map((st, i) => (
              <div key={i} className="step-row">
                <span className="step-num">{i + 1}</span>
                <input
                  type="text"
                  value={st}
                  onChange={(e) => handleStepChange(i, e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeStep(i)}
                  disabled={steps.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Featured */}
        <div className="checkbox-row">
          <input
            id="edit-is-featured"
            type="checkbox"
            name="is_featured"
            checked={formData.is_featured}
            onChange={(e) => setFormData((p) => ({ ...p, is_featured: e.target.checked }))}
            className="form-checkbox"
          />
          <label htmlFor="edit-is-featured" className="checkbox-label">
            Feature in Armory Showcase
          </label>
        </div>

        {/* Submit */}
        <div className="form-actions-bar">
          <button type="button" className="btn btn--outline" onClick={onBack} disabled={updating}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={updating}>
            {updating ? (
              <>
                <Loader size={18} className="spin" /> Updating Record…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>

      {/* Restore draft dialog */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Unsaved Changes?"
        message={`An unsaved draft for this product was saved on ${draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'}. Would you like to restore it?`}
        confirmLabel="Restore Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
