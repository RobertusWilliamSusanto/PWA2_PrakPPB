import { useState } from 'react'
import { ArrowLeft, Save, Camera, Check, ShieldAlert } from 'lucide-react'
import userService from '../services/userService'

export default function EditProfilePage({ onBack, onSuccess }) {
  const [profile] = useState(() => userService.getUserProfile())
  const [username, setUsername] = useState(profile.username || 'Shooter')
  const [bio, setBio] = useState(profile.bio || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [avatar, setAvatar] = useState(profile.avatar || null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  // Ownership check
  const currentUserId = userService.getUserIdentifier()
  const isOwner = profile.userId === currentUserId

  if (!isOwner) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center">
        <ShieldAlert size={48} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Akses Ditolak</h2>
        <p className="text-stone-400 mb-6">Hanya pemilik profil yang berhak mengubah data ini.</p>
        <button type="button" className="btn btn--primary" onClick={onBack}>
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>
    )
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran avatar harus di bawah 2MB.')
      setTimeout(() => setError(''), 3000)
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target.result
      setAvatar(base64)
      setFeedback('Avatar berhasil dipilih.')
      setTimeout(() => setFeedback(''), 2500)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = (e) => {
    e.preventDefault()
    setError('')
    setFeedback('')

    if (!username.trim()) {
      setError('Username tidak boleh kosong.')
      return
    }

    const updated = {
      ...profile,
      username: username.trim(),
      bio: bio.trim(),
      phone: phone.trim(),
      avatar,
      updatedAt: new Date().toISOString(),
    }

    const res = userService.saveUserProfile(updated)
    if (res.success) {
      setFeedback('Profil berhasil disimpan!')
      setTimeout(() => {
        if (onSuccess) onSuccess(updated)
        else if (onBack) onBack()
      }, 800)
    } else {
      setError(res.message || 'Gagal menyimpan profil.')
    }
  }

  return (
    <div className="edit-profile-page max-w-xl mx-auto py-8 px-4">
      <button type="button" className="detail-back mb-6 flex items-center gap-2" onClick={onBack}>
        <ArrowLeft size={18} /> Kembali ke Profil
      </button>

      <div className="bg-[#15191e] border border-stone-800 rounded-lg p-6">
        <h1 className="display text-2xl font-bold mb-2 text-stone-100">Edit Profil Operator</h1>
        <p className="text-sm text-stone-400 mb-6">
          Perbarui identitas publik, deskripsi armory, dan nomor kontak WhatsApp penjual Anda.
        </p>

        {feedback && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded text-sm flex items-center gap-2">
            <Check size={16} /> {feedback}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-stone-800 border-2 border-stone-700 flex items-center justify-center flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-stone-400">
                  {username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="avatar-upload"
                className="btn btn--outline cursor-pointer inline-flex items-center gap-2 text-sm"
              >
                <Camera size={16} /> Ganti Foto Avatar
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <p className="text-xs text-stone-500 mt-1">Maks 2MB (JPG, PNG)</p>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">
              Callsign / Nama Operator
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Ghost Operator"
              required
            />
          </div>

          {/* Phone (WhatsApp) */}
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">
              Nomor WhatsApp Penjual
            </label>
            <input
              type="tel"
              className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 081234567890"
            />
            <p className="text-xs text-stone-500 mt-1">
              Digunakan saat calon pembeli menekan tombol &quot;Hubungi Penjual&quot;.
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1">
              Bio / Deskripsi Profil
            </label>
            <textarea
              rows="4"
              className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded text-stone-100 focus:outline-none focus:border-amber-500"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ceritakan latar belakang armory Anda…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-stone-800">
            <button type="button" className="btn btn--outline" onClick={onBack}>
              Batal
            </button>
            <button type="submit" className="btn btn--primary flex items-center gap-2">
              <Save size={16} /> Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
