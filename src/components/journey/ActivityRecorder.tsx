import { useState, type FormEvent } from 'react'
import { Plus } from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import { db, getDailyLog, saveDailyLog } from '@/db'
import { ACTIVITIES, isActivityLog } from '@/lib/continuousTraining'
import { localDateKey } from '@/lib/date'
import type { ActivityLog, TrainingSettings } from '@/types'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'

export default function ActivityRecorder({ settings, updateSetting, defaultActivity = 'caminhada', onSaved }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting; defaultActivity?: string; onSaved?: () => void }) {
  const [open, setOpen] = useState(false)
  return <><button className="btn-secondary w-full" onClick={() => setOpen(true)}><Plus size={19} weight="bold" />Registrar atividade</button>{open && <ActivityForm settings={settings} updateSetting={updateSetting} defaultActivity={defaultActivity} onClose={() => setOpen(false)} onSaved={onSaved} />}</>
}

function ActivityForm({ settings, updateSetting, defaultActivity, onClose, onSaved }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting; defaultActivity: string; onClose: () => void; onSaved?: () => void }) {
  const today = localDateKey()
  const [activity, setActivity] = useState(defaultActivity === 'descanso' ? 'caminhada' : defaultActivity)
  const [custom, setCustom] = useState(''), [date, setDate] = useState(today)
  const [duration, setDuration] = useState(''), [distance, setDistance] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const type = activity === 'new' ? `custom:${custom.trim()}` : activity
    const name = type.startsWith('custom:') ? type.slice(7) : ACTIVITIES.find(item => item.id === type)?.name ?? type
    const log: ActivityLog = { id: crypto.randomUUID(), date, activity: type, name, durationMin: Number(duration.replace(',', '.')), ...(distance ? { distanceKm: Number(distance.replace(',', '.')) } : {}), completed: true }
    if (!isActivityLog(log) || date > today || name.length > 80 || !duration.trim()) { setError('Informe uma data até hoje, a atividade e um tempo maior que zero.'); return }
    setBusy(true); setError('')
    try {
      await db.transaction('rw', db.activityLogs, db.settings, db.dailyLogs, db.runningLogs, async () => {
        // Keep the running charts and the primary goal on the same actual record.
        if (type === 'corrida' && log.distanceKm) {
          const id = await db.runningLogs.add({ date, type: 'livre', distanceKm: log.distanceKm, durationMin: log.durationMin!, paceMinKm: log.durationMin! / log.distanceKm })
          log.id = `run:${id}`
        }
        await db.activityLogs.put(log)
        const existing = await getDailyLog(date)
        await saveDailyLog({ date, workoutDone: true, ...(!existing?.workoutDone ? { sessionType: type, sessionName: name, trainingLevel: settings.trainingLevel, lightVolume: settings.lightVolume } : {}) })
        if (type.startsWith('custom:')) await updateSetting('customActivities', [...new Set([...settings.customActivities, name])])
      })
      onSaved?.(); onClose()
    } catch { setError('Não foi possível registrar a atividade. Tente novamente.'); setBusy(false) }
  }
  return <BottomSheet title="Registrar atividade" description="Conte o que você fez. Cada registro contribui para sua evolução." onClose={onClose}><form className="space-y-5" onSubmit={event => void save(event)} noValidate><fieldset disabled={busy} className="space-y-4">
    <div><label className="label" htmlFor="activity-type">Atividade realizada</label><select id="activity-type" className="input" value={activity} onChange={event => setActivity(event.target.value)}>{ACTIVITIES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{settings.customActivities.map(name => <option key={name} value={`custom:${name}`}>{name}</option>)}<option value="new">Outra atividade…</option></select></div>
    {activity === 'new' && <div><label className="label" htmlFor="activity-custom">Nome da atividade</label><input id="activity-custom" className="input" value={custom} maxLength={80} onChange={event => setCustom(event.target.value)} /></div>}
    <div><label className="label" htmlFor="activity-date">Data</label><input id="activity-date" className="input" type="date" value={date} max={today} onChange={event => setDate(event.target.value)} /></div>
    <div><label className="label" htmlFor="activity-duration">Tempo realizado · minutos</label><input id="activity-duration" className="input" inputMode="decimal" placeholder="Ex.: 30" value={duration} onChange={event => setDuration(event.target.value)} /></div>
    <div><label className="label" htmlFor="activity-distance">Distância · km · opcional</label><input id="activity-distance" className="input" inputMode="decimal" placeholder="Ex.: 2,5" value={distance} onChange={event => setDistance(event.target.value)} /></div>
    </fieldset>{error && <p role="alert" className="text-[13px] text-red-600 dark:text-red-300">{error}</p>}<button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar atividade'}</button></form></BottomSheet>
}
