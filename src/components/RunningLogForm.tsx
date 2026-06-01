import { useState } from 'react'
import { Save, Calculator } from 'lucide-react'
import { saveRunningLog } from '@/db'
import type { RunningLog } from '@/types'

interface Props {
  defaultDate?: string
  defaultType?: 'qualidade' | 'longa'
  onSaved?: () => void
}

export default function RunningLogForm({ defaultDate, defaultType = 'qualidade', onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: defaultDate ?? today,
    type: defaultType as 'qualidade' | 'longa' | 'livre',
    distanceKm: '',
    durationMin: '',
    durationSec: '',
    hrAvg: '',
    effort: 7,
    notes: '',
  })
  const [saved, setSaved] = useState(false)

  const totalMin = (Number(form.durationMin) || 0) + (Number(form.durationSec) || 0) / 60
  const pace = form.distanceKm && totalMin
    ? totalMin / Number(form.distanceKm)
    : null
  const paceStr = pace
    ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')} min/km`
    : '—'

  async function handleSave() {
    if (!form.distanceKm || !totalMin) return
    const log: RunningLog = {
      date: form.date,
      type: form.type,
      distanceKm: Number(form.distanceKm),
      durationMin: totalMin,
      paceMinKm: pace ?? undefined,
      hrAvg: form.hrAvg ? Number(form.hrAvg) : undefined,
      effort: form.effort,
      notes: form.notes,
    }
    await saveRunningLog(log)
    setSaved(true)
    onSaved?.()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof form.type }))}>
            <option value="qualidade">Qualidade</option>
            <option value="longa">Longa</option>
            <option value="livre">Livre</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Distância (km)</label>
          <input type="number" step="0.01" min="0" className="input" placeholder="ex: 5.2"
            value={form.distanceKm}
            onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))} />
        </div>
        <div>
          <label className="label">Duração</label>
          <div className="flex gap-1.5">
            <input type="number" min="0" className="input text-center" placeholder="min"
              value={form.durationMin}
              onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))} />
            <span className="self-center text-slate-400 font-bold">:</span>
            <input type="number" min="0" max="59" className="input text-center" placeholder="seg"
              value={form.durationSec}
              onChange={e => setForm(f => ({ ...f, durationSec: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Pace calculado */}
      <div className="card p-3 flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30">
        <Calculator size={18} className="text-primary-500 flex-shrink-0" />
        <div>
          <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">Pace calculado</p>
          <p className="text-lg font-bold text-primary-700 dark:text-primary-300">{paceStr}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">FC Média (bpm)</label>
          <input type="number" min="50" max="220" className="input" placeholder="Opcional"
            value={form.hrAvg}
            onChange={e => setForm(f => ({ ...f, hrAvg: e.target.value }))} />
        </div>
        <div>
          <label className="label">Esforço — {form.effort}/10</label>
          <input type="range" min="1" max="10" step="1" className="w-full mt-3"
            value={form.effort}
            onChange={e => setForm(f => ({ ...f, effort: Number(e.target.value) }))} />
        </div>
      </div>

      <div>
        <label className="label">Notas</label>
        <textarea className="input resize-none" rows={2} placeholder="Como foi a corrida?"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <button onClick={handleSave} className="btn-primary w-full"
        disabled={!form.distanceKm || !totalMin}>
        <Save size={16} />
        {saved ? 'Corrida Salva!' : 'Registrar Corrida'}
      </button>
    </div>
  )
}
