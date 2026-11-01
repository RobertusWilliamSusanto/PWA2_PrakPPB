import { useState, useEffect, lazy, Suspense } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import PWABadge from './components/PWABadge.jsx'
import ConfirmModal from './components/modals/ConfirmModal.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import gunService from './services/gunService.js'
import { Loader } from 'lucide-react'
import './App.css'

// Lazy loaded pages & components (Tugas 3: Code splitting & lazy loading)
const Catalog = lazy(() => import('./pages/Catalog.jsx'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'))
const ArchivePage = lazy(() => import('./pages/ArchivePage.jsx'))
const CreateGunPage = lazy(() => import('./pages/CreateGunPage.jsx'))
const EditGunPage = lazy(() => import('./pages/EditGunPage.jsx'))
const GunDetail = lazy(() => import('./components/gun/GunDetail.jsx'))
const PublicSharePage = lazy(() => import('./pages/PublicSharePage.jsx'))

function App() {
  const [showSplash, setShowSplash] = useState(true)

  // Detect public share link on page load (?share=<token>) (Tugas 2)
  const initialShareToken = new URLSearchParams(window.location.search).get('share')
  const [shareToken, setShareToken] = useState(initialShareToken)

  const [tab, setTab] = useState('Catalog')
  const [mode, setMode] = useState(() => (initialShareToken ? 'share' : 'list'))
  const [selectedGun, setSelectedGun] = useState(null)
  const [editingGun, setEditingGun] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Listen for browser popstate / back button
  useEffect(() => {
    const handlePopState = () => {
      const token = new URLSearchParams(window.location.search).get('share')
      if (token) {
        setShareToken(token)
        setMode('share')
      } else if (mode === 'share') {
        setShareToken(null)
        setMode('list')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [mode])

  // Unified navigation handler
  const handleNavigate = (target, payload) => {
    if (target === 'Create') {
      setMode('create')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Edit') {
      setEditingGun(payload)
      setMode('edit')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Detail') {
      setSelectedGun(payload)
      setMode('detail')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Archive') {
      setMode('archive')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'EditProfile') {
      setMode('edit_profile')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Share') {
      setShareToken(payload)
      setMode('share')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Tab change
      setTab(target)
      setMode('list')
      setSelectedGun(null)
      setEditingGun(null)
      setShareToken(null)

      // Clean query string if closing share view
      if (window.location.search.includes('share=')) {
        window.history.replaceState(null, '', window.location.pathname)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBackToList = () => {
    setMode('list')
    setSelectedGun(null)
    setEditingGun(null)
    setShareToken(null)
    if (window.location.search.includes('share=')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  return (
    <div className="shell">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <Header
        tab={mode === 'list' ? tab : ''}
        onTab={(newTab) => handleNavigate(newTab)}
        onNavigateCreate={() => handleNavigate('Create')}
      />

      <main className="main">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <Loader size={36} className="spin text-brass mb-3" />
              <p className="text-steel text-sm">Memuat komponen armory…</p>
            </div>
          }
        >
          {/* Public Share Page view (Tugas 2) */}
          {mode === 'share' && (
            <PublicSharePage
              token={shareToken}
              onGoHome={() => {
                setShareToken(null)
                handleNavigate('Catalog')
              }}
            />
          )}

          {/* Sub-page views */}
          {mode === 'create' && (
            <CreateGunPage
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'edit' && (
            <EditGunPage
              gun={editingGun}
              gunId={editingGun?.id}
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'detail' && selectedGun && (
            <GunDetail
              gun={selectedGun}
              onBack={handleBackToList}
              onEdit={(g) => handleNavigate('Edit', g)}
              onDelete={(g) => setDeleteTarget(g)}
            />
          )}

          {/* Archive / Soft-delete page view (Tugas 6) */}
          {mode === 'archive' && (
            <ArchivePage
              onBack={handleBackToList}
              onRestored={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {/* Edit Profile separate page view (Tugas 5) */}
          {mode === 'edit_profile' && (
            <EditProfilePage
              onBack={() => {
                setMode('list')
                setTab('Profile')
              }}
              onSuccess={() => {
                setMode('list')
                setTab('Profile')
              }}
            />
          )}

          {/* Top-level Tabs */}
          {mode === 'list' && (
            <>
              {tab === 'Catalog' && (
                <Catalog
                  onNavigate={(destination, payload) => handleNavigate(destination, payload)}
                />
              )}
              {tab === 'Favorites' && (
                <FavoritesPage
                  onSelectGun={(g) => handleNavigate('Detail', g)}
                  onNavigateCatalog={() => setTab('Catalog')}
                />
              )}
              {tab === 'Profile' && (
                <ProfilePage
                  onReplaySplash={() => setShowSplash(true)}
                  onNavigateEditProfile={() => handleNavigate('EditProfile')}
                  onNavigateArchive={() => handleNavigate('Archive')}
                  onContinueDraft={(draft, draftId) => {
                    if (draftId === 'create') {
                      handleNavigate('Create')
                    } else {
                      handleNavigate('Edit', { id: draftId })
                    }
                  }}
                />
              )}
              {tab === 'About' && <About />}
              {tab === 'Contact' && <Contact />}
            </>
          )}
        </Suspense>
      </main>

      {/* Global Delete Confirmation (Soft-Delete) */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Arsipkan Hardware"
        message={`Apakah Anda yakin ingin mengarsipkan "${deleteTarget?.name}"? Katalog ini akan dipindahkan ke Arsip dan disembunyikan dari publik.`}
        confirmLabel="Ya, Arsipkan"
        danger
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            setDeleting(true)
            await gunService.deleteGun(deleteTarget.id)
            setDeleteTarget(null)
            handleBackToList()
            setTab('Catalog')
          } catch (err) {
            alert(err.message || 'Gagal mengarsipkan hardware.')
          } finally {
            setDeleting(false)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <PWABadge />
      <Footer />
    </div>
  )
}

export default App
