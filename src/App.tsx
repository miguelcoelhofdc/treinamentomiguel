import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import { useSettings } from '@/hooks/useSettings'

const Today = lazy(() => import('@/pages/Today'))
const Plan = lazy(() => import('@/pages/Plan'))
const Progress = lazy(() => import('@/pages/Progress'))
const Guides = lazy(() => import('@/pages/Guides'))
const Settings = lazy(() => import('@/pages/Settings'))

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

export default function App() {
  const { settings, updateSetting, loaded } = useSettings()

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
          <Route path="/ajustes" element={<Settings settings={settings} updateSetting={updateSetting} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  )
}
