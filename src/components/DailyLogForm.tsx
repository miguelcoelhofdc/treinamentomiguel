import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import { getDailyLog, saveDailyLog } from '@/db'
import type { DailyLog } from '@/types'

interface Props {
  date: string
  onSaved?: () => void
}

const energyLabels = ['', '😴 Exausto', '😕 Cansado', '😐 Ok', '😊 Bem', '💪 Ótimo']
const painLabels   = ['Sem dor', 'Leve', 'Moderada', 'Forte']

export default function DailyLogForm({ date, onSaved }: Props) {
  const [form, setForm] = useState<Omit<DailyLog, 'id' | 'date'>>({
    weightKg: undefined, sleepH: undefined, energy: undefined,
    shoulderPain: 0, kneePain: 0, rpe: undefined, notes: '', workoutDone: false,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getDailyLog(date).then(log => {
      if (log) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, date: _date, ...rest } = log
        setForm(rest)
        setSaved(true)
      }
    })
  }, [date])

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  async function handleSave() {
    await saveDailyLog({ date, ...form })
    setSaved(true)
    onSaved?.()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Peso AM (kg)</label>
          <input
            type="number" step="0.1" min="30" max="200"
            className="input" placeholder="ex: 79.5"
            value={form.weightKg ?? ''}
            onChange={e => set('weightKg', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <label className="label">Sono (horas)</label>
          <input
            type="number" step="0.5" min="0" max="16"
            className="input" placeholder="ex: 7.5"
            value={form.sleepH ?? ''}
            onChange={e => set('sleepH', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div>
        <label className="label">Energia — {form.energy ? energyLabels[form.energy] : 'Não registrado'}</label>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => set('energy', n as 1|2|3|4|5)}
              aria-label={`Energia: ${energyLabels[n]}`}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-150
                ${form.energy === n ? 'bg-primary-500 text-white' : 'bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-slate-300'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">RPE do treino — {form.rpe ? `${form.rpe}/10` : 'Não registrado'}</label>
        <input type="range" min="1" max="10" step="1" className="w-full accent-primary-500"
          value={form.rpe ?? 5}
          onChange={e => set('rpe', Number(e.target.value))}
        />
        <div className="flex justify-between text-xs text-slate-400 mt-0.5">
          <span>Fácil (1)</span><span>Máximo (10)</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Dor no Ombro</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[0,1,2,3].map(n => (
              <button key={n} onClick={() => set('shoulderPain', n as 0|1|2|3)}
                aria-label={`Dor no ombro: ${painLabels[n]}`}
                aria-pressed={form.shoulderPain === n}
                className={`min-h-11 px-1 py-1.5 rounded-xl text-[11px] font-semibold leading-tight transition-all
                  ${form.shoulderPain === n
                    ? n === 0 ? 'bg-green-500 text-white' : n === 1 ? 'bg-amber-400 text-amber-900' : n === 2 ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                    : 'bg-slate-100 dark:bg-neutral-700 text-slate-500'}`}>
                {painLabels[n]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Dor no Joelho</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[0,1,2,3].map(n => (
              <button key={n} onClick={() => set('kneePain', n as 0|1|2|3)}
                aria-label={`Dor no joelho: ${painLabels[n]}`}
                aria-pressed={form.kneePain === n}
                className={`min-h-11 px-1 py-1.5 rounded-xl text-[11px] font-semibold leading-tight transition-all
                  ${form.kneePain === n
                    ? n === 0 ? 'bg-green-500 text-white' : n === 1 ? 'bg-amber-400 text-amber-900' : n === 2 ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                    : 'bg-slate-100 dark:bg-neutral-700 text-slate-500'}`}>
                {painLabels[n]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="label">Observações</label>
        <textarea className="input resize-none" rows={2} placeholder="Como foi o treino hoje?"
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value)}
        />
      </div>

      <button onClick={handleSave} className="btn-primary w-full">
        <Save size={16} />
        {saved ? 'Atualizar Log' : 'Salvar Log do Dia'}
      </button>
    </div>
  )
}
