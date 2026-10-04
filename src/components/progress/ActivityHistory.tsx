import { useEffect, useState } from 'react'
import { CaretRight } from '@phosphor-icons/react'
import { db, getDailyLog } from '@/db'
import BottomSheet from '@/components/ui/BottomSheet'
import WellnessDetails from './WellnessDetails'
import { formatShortDate } from '@/lib/date'
import type { ActivityLog, DailyLog, RunningLog, StrengthLog } from '@/types'

export default function ActivityHistory({ activities }: { activities: ActivityLog[] }) {
  const [visible, setVisible] = useState(12)
  const [selected, setSelected] = useState<ActivityLog | null>(null)
  const rows = [...activities].reverse().slice(0, visible)
  const groups = new Map<string, ActivityLog[]>()
  rows.forEach(row => groups.set(row.date, [...(groups.get(row.date) ?? []), row]))
  return <>
    {[...groups].map(([date, items]) => <section key={date} aria-label={'Atividades de ' + formatShortDate(date)}>
      <h2 className="history-date">{formatShortDate(date)}</h2>
      {items.map(item => <button key={item.id} className="history-row" onClick={() => setSelected(item)}>
        <span className="min-w-0 flex-1"><span className="block text-[16px] font-medium break-words">{item.name}</span><span className="helper block">{item.durationMin == null ? 'Tempo não informado' : item.durationMin.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' min'}{item.distanceKm == null ? '' : ' · ' + item.distanceKm.toLocaleString('pt-BR') + ' km'}</span></span><CaretRight size={18} className="shrink-0 text-ink-muted" />
      </button>)}
    </section>)}
    {activities.length > visible && <button className="btn-secondary mt-6" onClick={() => setVisible(value => value + 12)}>Ver mais atividades</button>}
    {selected && <ActivityDetails key={selected.id} activity={selected} onClose={() => setSelected(null)} />}
  </>
}

function ActivityDetails({ activity, onClose }: { activity: ActivityLog; onClose: () => void }) {
  const [data, setData] = useState<{ log?: DailyLog; runs: RunningLog[]; strength: StrengthLog[] }>()
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(false)
    Promise.all([getDailyLog(activity.date), db.runningLogs.where('date').equals(activity.date).toArray(), db.strengthLogs.where('date').equals(activity.date).toArray()])
      .then(([log, runs, strength]) => { if (active) setData({ log, runs, strength }) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [activity.date, attempt])
  const ownRun = data?.runs.find(run => activity.id === 'run:' + run.id)
  const paceSeconds = ownRun?.paceMinKm == null ? null : Math.round(ownRun.paceMinKm * 60)
  return <BottomSheet title={activity.name} description={formatShortDate(activity.date)} onClose={onClose}>
    <dl className="health-details mb-6"><div><dt>Tempo registrado</dt><dd>{activity.durationMin == null ? 'Não informado' : activity.durationMin.toLocaleString('pt-BR') + ' min'}</dd></div>{activity.distanceKm != null && <div><dt>Distância</dt><dd>{activity.distanceKm.toLocaleString('pt-BR') + ' km'}</dd></div>}</dl>
    {error ? <div role="alert" className="state-block"><p>Não foi possível abrir os detalhes.</p><button className="btn-secondary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>
    : !data ? <div className="skeleton h-28" aria-label="Carregando detalhes" aria-busy="true" /> : <>
      {ownRun && <div className="mb-6 text-[14px] leading-6">{ownRun.paceMinKm != null && <p>Pace: {Math.floor(paceSeconds! / 60)}:{String(paceSeconds! % 60).padStart(2, '0')} min/km</p>}{ownRun.hrAvg != null && <p>Frequência cardíaca média: {ownRun.hrAvg} bpm</p>}{ownRun.effort != null && <p>Esforço: {ownRun.effort}/10</p>}{ownRun.notes && <p className="mt-2 whitespace-pre-wrap">{ownRun.notes}</p>}</div>}
      <h3 className="text-[16px] font-medium mb-4">Bem-estar neste dia</h3><WellnessDetails log={data.log} />
      {data.strength.length > 0 && <section className="mt-8"><h3 className="text-[16px] font-medium mb-4">Cargas registradas no dia</h3><div className="space-y-4">{data.strength.map(record => <div key={record.id}><p className="text-[14px] font-medium">{record.exercise}</p><p className="helper">{record.sets.map(set => set.weightKg + ' kg × ' + set.reps).join(' · ')}</p>{record.notes && <p className="helper">{record.notes}</p>}</div>)}</div></section>}
    </>}
  </BottomSheet>
}
