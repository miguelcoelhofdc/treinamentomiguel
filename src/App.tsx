import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import { useSettings } from '@/hooks/useSettings'
import Access from '@/pages/Access'
import { useLocalDay } from '@/hooks/useLocalDay'
import {
  ACCESS_PROFILES,
  clearStoredProfile,
  getStoredProfileId,
  type ProfileId,
} from '@/lib/auth'

const TrackingHome = lazy(() => import('@/pages/TrackingHome'))
const Recorder = lazy(() => import('@/pages/Recorder'))
const TrackingHistory = lazy(() => import('@/pages/TrackingHistory'))
const WorkoutTemplates = lazy(() => import('@/pages/WorkoutTemplates'))
const Guides = lazy(() => import('@/pages/Guides'))
const Settings = lazy(() => import('@/pages/Settings'))
const Goals = lazy(() => import('@/pages/Goals'))
const Whiteboard = lazy(() => import('@/pages/Whiteboard'))
const DevVisualizer = import.meta.env.DEV ? lazy(() => import('@/pages/DevVisualizer')) : null

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

function ProgressRedirect() {
  const { search } = useLocation()
  return <Navigate to={new URLSearchParams(search).get('aba') === 'historico' ? '/historico' : '/'} replace />
}

function AppSkeleton() {
  return (
    <div className="page-content space-y-5" aria-label="Carregando conteúdo" aria-busy="true">
      <div className="space-y-2">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton h-9 w-44" />
      </div>
      <div className="skeleton h-52 w-full rounded-[28px]" />
      <div className="skeleton h-20 w-full rounded-[22px]" />
      <div className="skeleton h-20 w-full rounded-[22px]" />
    </div>
  )
}

function AuthenticatedApp({ profileId }: { profileId: ProfileId }) {
  const { settings, updateSetting, loaded, error, retry } = useSettings()
  const today = useLocalDay()
  const activeProfile = ACCESS_PROFILES[profileId]

  useEffect(() => {
    if (!loaded) return
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
    const previous = metas.map(meta => meta.content)
    metas.forEach(meta => { meta.content = settings.darkMode ? '#121916' : '#F7F9F7' })
    return () => metas.forEach((meta, index) => { meta.content = previous[index] })
  }, [settings.darkMode, loaded])

  const handleLogout = () => {
    clearStoredProfile()
    window.location.assign('/')
  }

  if (!loaded) return <div className="app-shell training-theme tracking-theme"><AppSkeleton /></div>
  if (error) return <div className="app-shell training-theme tracking-theme"><div className="page-content"><h1 className="page-title">Não foi possível abrir seu perfil.</h1><button className="btn-primary mt-5" onClick={retry}>Tentar novamente</button></div></div>

  return (
    <div className="app-shell training-theme tracking-theme">
      <ScrollToTop />
      <Suspense fallback={<AppSkeleton />}>
        <Routes>
          <Route path="/" element={<TrackingHome settings={settings} />} />
          <Route path="/registrar" element={<Recorder key={today} />} />
          <Route path="/historico" element={<TrackingHistory />} />
          <Route path="/fichas" element={<WorkoutTemplates />} />
          <Route path="/hoje" element={<Navigate to="/registrar" replace />} />
          <Route path="/plano" element={<Navigate to="/fichas" replace />} />
          <Route path="/coaching" element={<Navigate to="/fichas" replace />} />
          <Route path="/progresso" element={<ProgressRedirect />} />
          <Route path="/guias" element={<Guides routineType={settings.routineType} />} />
          <Route
            path="/ajustes"
            element={(
              <Settings
                settings={settings}
                updateSetting={updateSetting}
                profileId={profileId}
                profileLabel={activeProfile.label}
                onLogout={handleLogout}
              />
            )}
          />
          {DevVisualizer && <Route path="/dev/viz" element={<DevVisualizer />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <div id="training-overlays" />
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  const standalonePath = pathname.replace(/\/+$/, '')

  if (standalonePath === '/quadro') {
    return (
      <Suspense fallback={<div className="min-h-[100dvh] bg-white" aria-label="Carregando quadro" aria-busy="true" />}>
        <Whiteboard />
      </Suspense>
    )
  }

  if (standalonePath === '/metas') {
    return (
      <Suspense fallback={<div className="min-h-[100dvh] bg-[#f3f6f4]" aria-label="Carregando painel de metas" aria-busy="true" />}>
        <Goals />
      </Suspense>
    )
  }

  const profileId = getStoredProfileId()
  if (!profileId) return <Access />
  return <AuthenticatedApp profileId={profileId} />
}
