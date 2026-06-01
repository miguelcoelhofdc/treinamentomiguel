import { useState } from 'react'
import { Moon, Sun, Download, Upload, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { db } from '@/db'
import type { DailyLog, RunningLog, StrengthLog } from '@/types'

type SettingsData = {
  startDate: string; name: string; height: number;
  initialWeight: number; goalWeight: number;
  darkMode: boolean; routineType: 'morning' | 'evening'
}

interface Props {
  settings: SettingsData
  updateSetting: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void
}

export default function Settings({ settings, updateSetting }: Props) {
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const handleExport = async () => {
    const [daily, running, strength] = await Promise.all([
      db.dailyLogs.toArray(),
      db.runningLogs.toArray(),
      db.strengthLogs.toArray(),
    ])
    const data = { daily, running, strength, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `treino-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text) as {
        daily: DailyLog[]; running: RunningLog[]; strength: StrengthLog[]
      }
      if (data.daily) {
        for (const log of data.daily) {
          const { id: _id, ...rest } = log
          await db.dailyLogs.add(rest)
        }
      }
      if (data.running) {
        for (const log of data.running) {
          const { id: _id, ...rest } = log
          await db.runningLogs.add(rest)
        }
      }
      alert('Dados importados com sucesso!')
    } catch {
      alert('Erro ao importar: arquivo inválido.')
    }
  }

  const handleReset = async () => {
    await db.dailyLogs.clear()
    await db.runningLogs.clear()
    await db.strengthLogs.clear()
    await db.exerciseChecks.clear()
    setConfirmReset(false)
    alert('Todos os dados foram apagados.')
  }

  return (
    <div className="page-content page-enter space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Ajustes</h1>

      {/* Profile */}
      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Perfil</h3>
        <div>
          <label className="label">Nome</label>
          <input type="text" className="input" value={settings.name}
            onChange={e => updateSetting('name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Altura (cm)</label>
            <input type="number" min="100" max="250" className="input" value={settings.height}
              onChange={e => updateSetting('height', Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Peso inicial (kg)</label>
            <input type="number" step="0.1" min="30" max="300" className="input" value={settings.initialWeight}
              onChange={e => updateSetting('initialWeight', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="label">Meta de peso (kg)</label>
          <input type="number" step="0.1" min="30" max="300" className="input" value={settings.goalWeight}
            onChange={e => updateSetting('goalWeight', Number(e.target.value))} />
        </div>
      </div>

      {/* Start date */}
      <div className="card p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Data de Início</h3>
          <p className="text-xs text-slate-400 mt-0.5">Alterar recalcula todas as semanas do plano.</p>
        </div>
        <input type="date" className="input" value={settings.startDate}
          onChange={e => { updateSetting('startDate', e.target.value); save() }} />
        {saved && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle size={14} /> Salvo!
          </div>
        )}
      </div>

      {/* Routine type */}
      <div className="card p-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Horário de treino preferido</h3>
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-600">
          {(['morning', 'evening'] as const).map(rt => (
            <button key={rt} onClick={() => updateSetting('routineType', rt)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors
                ${settings.routineType === rt ? 'bg-primary-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {rt === 'morning' ? '🌅 Manhã' : '🌙 Noite'}
            </button>
          ))}
        </div>
      </div>

      {/* Dark mode */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.darkMode ? <Moon size={20} className="text-slate-600 dark:text-slate-300" /> : <Sun size={20} className="text-amber-500" />}
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Tema</p>
              <p className="text-xs text-slate-400">{settings.darkMode ? 'Escuro' : 'Claro'}</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('darkMode', !settings.darkMode)}
            aria-label="Ativar modo escuro"
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-400
              ${settings.darkMode ? 'bg-primary-500' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
              ${settings.darkMode ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Backup */}
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">Backup de Dados</h3>
        <p className="text-xs text-slate-400">Todos os seus registros ficam salvos localmente no dispositivo.</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExport}
            className="btn-ghost border border-slate-200 dark:border-neutral-600 w-full">
            <Download size={16} /> Exportar JSON
          </button>
          <label className="btn-ghost border border-slate-200 dark:border-neutral-600 w-full cursor-pointer">
            <Upload size={16} /> Importar JSON
            <input type="file" accept=".json" className="sr-only" onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Reset */}
      <div className="card p-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Zona de Perigo</h3>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="flex items-center gap-2 text-red-500 text-sm font-medium py-2">
            <Trash2 size={16} /> Apagar todos os dados
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">Esta ação é irreversível! Todos os logs e registros serão apagados permanentemente.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold">
                Apagar tudo
              </button>
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
