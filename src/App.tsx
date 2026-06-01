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
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-neutral-900">
        <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" />
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
