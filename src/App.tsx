import { Routes, Route } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import Today from '@/pages/Today'
import Plan from '@/pages/Plan'
import Progress from '@/pages/Progress'
import Guides from '@/pages/Guides'
import Settings from '@/pages/Settings'
import { useSettings } from '@/hooks/useSettings'

export default function App() {
  const { settings, updateSetting, loaded } = useSettings()

  if (!loaded) {
    return (
      <div className="page-content space-y-4 pt-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 w-full" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="bg-slate-50 dark:bg-neutral-900 min-h-screen">
      <Routes>
        <Route path="/"         element={<Today startDate={settings.startDate} />} />
        <Route path="/plano"    element={<Plan  startDate={settings.startDate} />} />
        <Route path="/progresso" element={<Progress />} />
        <Route path="/guias"    element={<Guides />} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Route path="/ajustes"  element={<Settings settings={settings} updateSetting={updateSetting as any} />} />
      </Routes>
      <BottomNav />
    </div>
  )
}
