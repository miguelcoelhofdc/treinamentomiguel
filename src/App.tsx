import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import { useSettings } from '@/hooks/useSettings'
import Access from '@/pages/Access'
import {
  ACCESS_PROFILES,
  clearStoredProfile,
  getStoredProfileId,
  type ProfileId,
} from '@/lib/auth'

const Today = lazy(() => import('@/pages/Today'))
const Plan = lazy(() => import('@/pages/Plan'))
const Progress = lazy(() => import('@/pages/Progress'))
const Guides = lazy(() => import('@/pages/Guides'))
const Settings = lazy(() => import('@/pages/Settings'))
const DevVisualizer = import.meta.env.DEV ? lazy(() => import('@/pages/DevVisualizer')) : null

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return null
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
  const { settings, updateSetting, loaded } = useSettings()
  const activeProfile = ACCESS_PROFILES[profileId]

  const handleLogout = () => {
    clearStoredProfile()
    window.location.assign('/')
  }

  if (!loaded) return <div className="app-shell"><AppSkeleton /></div>

  return (
    <div className="app-shell">
      <ScrollToTop />
      <Suspense fallback={<AppSkeleton />}>
        <Routes>
          <Route path="/" element={<Today startDate={settings.startDate} name={settings.name} />} />
          <Route path="/plano" element={<Plan startDate={settings.startDate} />} />
          <Route
            path="/progresso"
            element={<Progress initialWeight={settings.initialWeight} goalWeight={settings.goalWeight} />}
          />
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
      <BottomNav />
    </div>
  )
}

export default function App() {
  const profileId = getStoredProfileId()
  if (!profileId) return <Access />
  return <AuthenticatedApp profileId={profileId} />
}
