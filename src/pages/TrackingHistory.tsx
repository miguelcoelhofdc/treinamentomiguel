import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight, Heart, PencilSimple, Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import { useTracking } from '@/hooks/useTracking'
import { ACTIVITY_LABELS, activitySummary, hasWellness, numberLabel, sessionStrength } from '@/lib/tracking'
import { formatShortDate } from '@/lib/date'
import CheckInForm from '@/components/tracking/CheckInForm'
import RoutineReviewForm from '@/components/tracking/RoutineReviewForm'
import RoutineTrends from '@/components/tracking/RoutineTrends'
import HomeTrends from '@/components/tracking/HomeTrends'
import { readingLabel, routineReading } from '@/lib/routines'
import { addCalendarDays, calendarDay, isDateKey } from '@/lib/date'
import SessionDetails from '@/components/tracking/SessionDetails'
import { ActivityBadge, EmptyBlock, SavedNotice, TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'
import type { ActivityLog } from '@/types'

export default function TrackingHistory() {
  const data = useTracking()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<ActivityLog | null>(null)
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [visible, setVisible] = useState(14)
  const [days, setDays] = useState(30)
  const [review, setReview] = useState<{ date: string; routineId?: string } | null>(null)
  const selectedRoutine = filter.startsWith('routine:') ? data.routines.find(routine => routine.id === filter.slice(8)) : undefined
  const from = days ? addCalendarDays(data.today, 1 - days) : '0001-01-01'
  const inPeriod = (date: string) => isDateKey(date) && date >= from && date <= data.today
  const activities = data.activities.filter(activity => inPeriod(activity.date) && (filter === 'all' || activity.activity === filter || (selectedRoutine?.kind === 'exercise' && (selectedRoutine.activity === 'all' || selectedRoutine.activity === activity.activity))))
  const healthRoutines = data.routines.filter(routine => routine.kind !== 'exercise' && (filter === 'all' || selectedRoutine?.id === routine.id))
  const healthDates = [...new Set([...data.daily.map(log => log.date), ...data.entries.map(entry => entry.date)])].filter(date => inPeriod(date) && healthRoutines.some(routine => routineReading(routine, date, data) != null))
  const dates = [...new Set([...activities.map(activity => activity.date), ...healthDates, ...(filter === 'all' || filter === 'dia' ? [...data.byDate.values()].filter(log => hasWellness(log) && inPeriod(log.date)).map(log => log.date) : [])])].sort().reverse()
  const firstDate = [...data.daily.map(log => log.date), ...data.entries.map(entry => entry.date), ...data.activities.map(item => item.date), data.today].filter(isDateKey).sort()[0]
  const chartDays = days || calendarDay(data.today) - calendarDay(firstDate) + 1
  const filters = [...new Set(data.activities.map(activity => activity.activity))]
  return <main className="page-content tracking-history page-enter">
    <PageHeader title="Histórico" description="O que você fez, no seu ritmo." action={<Link className="btn-primary" to="/registrar"><Plus size={20} />Registrar</Link>} />
    <div className="form-columns"><label className="history-filter"><span className="label">Mostrar</span><select className="input" value={filter} onChange={event => { setFilter(event.target.value); setVisible(14) }}><option value="all">Todos os registros</option>{data.routines.map(routine => <option key={routine.id} value={`routine:${routine.id}`}>{routine.name}{routine.enabled ? '' : ' · desativado'}</option>)}{filters.filter(type => !data.routines.some(routine => routine.activity === type)).map(type => <option key={type} value={type}>{ACTIVITY_LABELS[type] ?? type.replace(/^custom:/, '')}</option>)}<option value="dia">Check-ins do dia</option></select></label><label className="history-filter"><span className="label">Período</span><select className="input" value={days} onChange={event => { setDays(Number(event.target.value)); setVisible(14) }}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={0}>Todo o histórico</option></select></label></div>
    {data.loaded && !data.error && selectedRoutine && selectedRoutine.kind !== 'exercise' && <RoutineTrends data={data} routineId={selectedRoutine.id} days={chartDays} />}
    {data.loaded && !data.error && selectedRoutine?.kind === 'exercise' && <HomeTrends key={selectedRoutine.id} data={data} rangeDays={chartDays} showAll activityFilter={selectedRoutine.activity} />}
    {saved && <SavedNotice>Registro atualizado. Seus gráficos já refletem a alteração.</SavedNotice>}
    {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : !dates.length ? <section className="tracking-panel"><EmptyBlock title="Nenhum registro por aqui ainda" action={<Link to="/registrar" className="btn-secondary">Fazer um registro</Link>}>Escolha outro filtro ou registre uma atividade ou como foi seu dia.</EmptyBlock></section> : <>
      {dates.slice(0, visible).map(date => {
        const daily = data.byDate.get(date)
        const items = activities.filter(activity => activity.date === date).reverse()
        const legacyStrength = data.strength.filter(record => record.date === date && !record.activityLogId)
        const legacyShown = items.some(activity => activity.id.startsWith('legacy-strength:'))
        return <section className="history-day" key={date}><h2>{formatShortDate(date)}<span>{date.slice(0, 4)}</span></h2><div className="tracking-panel history-day-panel">
          {items.map(activity => {
            const sets = sessionStrength(activity, data.strength)
            return <button className="history-session" key={activity.id} onClick={() => { setSelected(activity); setSaved(false) }}><ActivityBadge activity={activity.activity} /><span className="min-w-0 flex-1"><strong>{activity.name}</strong><span className="helper block">{activitySummary(activity)}{sets.length ? ` · ${sets.length} ${sets.length === 1 ? 'exercício' : 'exercícios'}` : ''}</span></span><CaretRight size={20} /></button>
          })}
          {legacyStrength.length > 0 && !legacyShown && (filter === 'all' || selectedRoutine?.kind === 'exercise' && ['all', 'forca', 'calistenia'].includes(selectedRoutine.activity!)) && <div className="legacy-strength-day"><span className="small-label">Cargas do dia · registro antigo</span>{legacyStrength.map(record => <p key={record.id}><strong>{record.exercise}</strong><span>{record.sets.map(set => `${numberLabel(set.weightKg)} kg × ${set.reps}`).join(' · ')}</span></p>)}<button className="inline-link mt-2" onClick={() => setSelected({ id: `day-strength:${date}`, date, activity: 'forca', name: 'Cargas antigas do dia', completed: true })}>Editar cargas do dia<PencilSimple size={17} /></button></div>}
          {healthRoutines.map(routine => {
            const reading = routineReading(routine, date, data)
            return reading && <button key={routine.id} className="history-checkin" onClick={() => { setReview({ date, routineId: routine.id }); setSaved(false) }}><Heart size={21} weight="duotone" /><span className="flex-1 text-left"><strong>{routine.name}</strong><span className="helper block">{readingLabel(routine, reading)}</span></span><PencilSimple size={18} /></button>
          })}
          {(filter === 'all' || filter === 'dia') && hasWellness(daily) && <button className="history-checkin" onClick={() => { setCheckIn(date); setSaved(false) }}><Heart size={21} weight="duotone" /><span className="flex-1 text-left">Ver ou editar check-in completo</span><PencilSimple size={18} /></button>}
        </div></section>
      })}
      {dates.length > visible && <button className="btn-secondary w-full" onClick={() => setVisible(current => current + 14)}>Ver mais registros</button>}
    </>}
    {selected && <SessionDetails activity={selected} data={data} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setSaved(true) }} />}
    {review && <BottomSheet title="Editar registro" description={formatShortDate(review.date)} onClose={() => setReview(null)}><RoutineReviewForm data={data} date={review.date} routineId={review.routineId} onSaved={() => { setReview(null); setSaved(true) }} /></BottomSheet>}
    {checkIn && <BottomSheet title="Como foi seu dia?" description={formatShortDate(checkIn)} onClose={() => setCheckIn(null)}><CheckInForm date={checkIn} log={data.byDate.get(checkIn)} onSaved={() => { setCheckIn(null); setSaved(true) }} /></BottomSheet>}
  </main>
}
