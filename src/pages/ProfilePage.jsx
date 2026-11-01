import { useState } from 'react'
import {
  Shield,
  Copy,
  Check,
  Heart,
  FileText,
  Play,
  UserCheck,
  Phone,
  Mail,
  Edit3,
  Trash2,
  ArrowRight,
  Archive,
} from 'lucide-react'
import userService from '../services/userService'
import { useFavorites } from '../hooks/useFavorites'
import {
  getAllDraftIds,
  loadDraft,
  deleteDraft,
  formatDraftTime,
} from '../utils/draftStorage'

/**
 * ProfilePage — User identity and Armory settings.
 * Split into sections:
 *  a. About
 *  b. Contact
 *  c. Drafts (Catalog draft items moved here)
 *  d. Separate Edit Profile Navigation
 */
export default function ProfilePage({
  onReplaySplash,
  onNavigateEditProfile,
  onContinueDraft,
  onNavigateArchive,
}) {
  const [profile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)
  const { favorites } = useFavorites()

  // Load active offline drafts from localStorage
  const [draftIds, setDraftIds] = useState(() => getAllDraftIds())

  const drafts = draftIds
    .map((id) => ({ id, data: loadDraft(id) }))
    .filter((item) => item.data != null)

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDeleteDraft = (id) => {
    if (window.confirm('Hapus draft katalog ini?')) {
      deleteDraft(id)
      setDraftIds(getAllDraftIds())
    }
  }

  return (
    <div className="profile-page max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <section
        className="masthead mb-6"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="display text-3xl font-bold">Operator Profile</h1>
          <p className="lede text-stone-400">
            Kredensial operator, spesifikasi kontak penjual, dan inventaris draft katalog.
          </p>
        </div>
        <div className="flex gap-2">
          {onNavigateArchive && (
            <button
              type="button"
              className="btn btn--outline btn--sm flex items-center gap-1.5"
              onClick={onNavigateArchive}
              title="Buka Arsip Katalog"
            >
              <Archive size={14} /> Arsip Katalog
            </button>
          )}
          {onReplaySplash && (
            <button
              type="button"
              className="btn btn--outline btn--sm flex items-center gap-1.5"
              onClick={onReplaySplash}
              title="Putar ulang animasi intro"
            >
              <Play size={14} /> Replay Intro
            </button>
          )}
        </div>
      </section>

      {/* Hero Operator Header Card */}
      <div className="profile-card bg-[#15191e] border border-stone-800 rounded-lg p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="avatar-wrap relative w-20 h-20 rounded-full overflow-hidden border-2 border-stone-700 bg-stone-900 flex items-center justify-center flex-shrink-0">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <Shield size={36} className="text-amber-500" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="display text-2xl font-bold text-stone-100">
                {profile.username || 'Shooter'}
              </h2>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <UserCheck size={12} /> Verified Armorer
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="mono-badge text-xs font-mono text-stone-400 bg-stone-900 px-2 py-1 rounded">
                ID: {profile.userId?.slice(0, 18)}…
              </span>
              <button
                type="button"
                className="p-1 rounded hover:bg-stone-800 text-stone-400"
                onClick={handleCopyId}
                title="Copy Full User ID"
              >
                {copied ? <Check size={14} className="text-amber-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Section d: Edit Profile Button (navigates to separate edit page) */}
        <div>
          <button
            type="button"
            className="btn btn--primary flex items-center gap-2"
            onClick={onNavigateEditProfile}
          >
            <Edit3 size={16} /> Edit Profile
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Section a: About */}
        <section className="bg-[#15191e] border border-stone-800 rounded-lg p-6">
          <h3 className="section-title text-lg font-bold text-stone-200 mb-4 pb-2 border-b border-stone-800 flex items-center gap-2">
            <Shield size={18} className="text-amber-500" /> Section A: About Armorer
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                Deskripsi & Kualifikasi
              </label>
              <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-line">
                {profile.bio ||
                  'Operator resmi Bore & Barrel. Bertanggung jawab atas verifikasi spesifikasi hardware, kaliber amunisi, dan standar perawatan senjata.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 bg-stone-900/60 rounded border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-amber-400 text-sm font-semibold mb-1">
                  <Heart size={16} /> Favorit
                </div>
                <div className="text-xl font-bold text-stone-100">{favorites.length} Item</div>
              </div>
              <div className="p-3 bg-stone-900/60 rounded border border-stone-800/80">
                <div className="flex items-center gap-1.5 text-stone-400 text-sm font-semibold mb-1">
                  <FileText size={16} /> Draft Aktif
                </div>
                <div className="text-xl font-bold text-stone-100">{drafts.length} Item</div>
              </div>
            </div>
          </div>
        </section>

        {/* Section b: Contact */}
        <section className="bg-[#15191e] border border-stone-800 rounded-lg p-6">
          <h3 className="section-title text-lg font-bold text-stone-200 mb-4 pb-2 border-b border-stone-800 flex items-center gap-2">
            <Phone size={18} className="text-emerald-500" /> Section B: Contact Channels
          </h3>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-stone-400 mt-1 flex-shrink-0" />
              <div>
                <span className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  WhatsApp Penjual
                </span>
                <span className="text-stone-200 font-mono">
                  {profile.phone || '0812-3456-7890'}
                </span>
                <p className="text-xs text-stone-500 mt-0.5">
                  Tautan WhatsApp otomatis terintegrasi pada tombol &quot;Hubungi Penjual&quot;.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail size={16} className="text-stone-400 mt-1 flex-shrink-0" />
              <div>
                <span className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  Saluran Komunikasi
                </span>
                <span className="text-stone-200">armory-procurement@borebarrel.internal</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded text-emerald-300 text-xs">
              Calon pembeli dapat menghubungi penjual secara langsung melalui WhatsApp dengan pesan otomatis yang menyertakan nama produk dan share link.
            </div>
          </div>
        </section>
      </div>

      {/* Section c: Drafts (PINDAHKAN dari lokasi lamanya, bukan duplikasi) */}
      <section className="bg-[#15191e] border border-stone-800 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-4">
          <h3 className="section-title text-lg font-bold text-stone-200 flex items-center gap-2">
            <FileText size={18} className="text-amber-500" /> Section C: Draft Katalog Belum Terbit
          </h3>
          <span className="text-xs bg-stone-900 text-stone-400 px-2.5 py-1 rounded">
            {drafts.length} draft tersimpan
          </span>
        </div>

        {drafts.length === 0 ? (
          <div className="text-center py-8 text-stone-500 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-40" />
            Tidak ada draft tersimpan. Saat Anda membuat atau mengedit katalog, data otomatis disimpan di sini jika belum dipublikasikan.
          </div>
        ) : (
          <div className="divide-y divide-stone-800">
            {drafts.map(({ id, data }) => (
              <div key={id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-stone-200 text-base">
                    {data.name || 'Draft Tanpa Judul'}
                  </h4>
                  <p className="text-xs text-stone-400">
                    Kategori: {data.type || data.category || 'Hardware'} · Kaliber: {data.caliber || 'Standard'} · Disimpan {formatDraftTime(data.savedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {onContinueDraft && (
                    <button
                      type="button"
                      className="btn btn--outline btn--sm flex items-center gap-1 text-xs"
                      onClick={() => onContinueDraft(data, id)}
                    >
                      Lanjutkan <ArrowRight size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded"
                    onClick={() => handleDeleteDraft(id)}
                    title="Hapus draft"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
