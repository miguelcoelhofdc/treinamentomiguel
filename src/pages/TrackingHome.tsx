import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, CaretRight, CheckCircle, Clock, Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import { useTracking } from '@/hooks/useTracking'
import { addCalendarDays, formatShortDate } from '@/lib/date'
import { activitySummary, hasWellness, numberLabel, sessionStrength } from '@/lib/tracking'
import ProgressChart from '@/components/tracking/ProgressChart'
import CheckInForm from '@/components/tracking/CheckInForm'
import SessionDetails from '@/components/tracking/SessionDetails'
import { ActivityBadge, EmptyBlock, SavedNotice, TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'
import type { TrainingSettings } from '@/types'

export default function TrackingHome({ settings }: { settings: TrainingSettings }) {
  const data = useTracking()
  const [details, setDetails] = useState(false)
  const [checkIn, setCheckIn] = useState(false)
  const [saved, setSaved] = useState('')
  const weekly = data.activities.filter(activity => activity.date >= addCalendarDays(data.today, -6))
  const days = new Set(weekly.map(activity => activity.date)).size
  const minutes = weekly.reduce((sum, activity) => sum + (activity.durationMin ?? 0), 0)
  const hasTime = weekly.some(activity => activity.durationMin != null)
  const latest = data.activities.at(-1)
  const records = latest ? sessionStrength(latest, data.strength) : []
  const todayLog = data.byDate.get(data.today)
  const checkedIn = hasWellness(todayLog)
  return <main className="page-content tracking-home page-enter">
    <PageHeader eyebrow={formatShortDate(data.today)} title={`Oi, ${settings.name.trim().split(' ')[0] || 'atleta'}!`} description="Seu ritmo, seu progresso." action={<Link to="/registrar" className="btn-primary"><Plus size={20} weight="bold" />Registrar</Link>} />
    {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : <>
      {saved && <SavedNotice>{saved}</SavedNotice>}
      <section className="weekly-summary" aria-label="Resumo dos últimos sete dias">
        <div className="summary-item"><span className="summary-icon icon-green"><CalendarCheck size={25} weight="duotone" /></span><div><p><strong>{days}</strong><span> de 7 dias</span></p><span className="helper">Dias ativos · últimos 7 dias</span></div></div>
        <div className="summary-item"><span className="summary-icon icon-blue"><Clock size={25} weight="duotone" /></span><div><p><strong>{hasTime ? numberLabel(minutes) : '—'}</strong><span> min</span></p><span className="helper">Tempo informado · 7 dias</span></div></div>
      </section>
      <ProgressChart data={data} />
      <div className="home-secondary">
        <section className="tracking-panel latest-session"><div className="section-heading"><h2>Último treino</h2><Link to="/historico" className="inline-link">Histórico<ArrowRight size={17} /></Link></div>
          {latest ? <button className="latest-session-link" onClick={() => setDetails(true)}><ActivityBadge activity={latest.activity} /><span className="min-w-0 flex-1"><span className="small-label">{formatShortDate(latest.date)}</span><strong>{latest.name}</strong><span className="helper block">{activitySummary(latest)}</span>{records.length > 0 && <span className="latest-strength">{records.length} {records.length === 1 ? 'exercício' : 'exercícios'} · {records[0].exercise}: {records[0].sets.map(set => `${numberLabel(set.weightKg)} kg × ${set.reps}`).join(' · ')}</span>}</span><CaretRight size={20} className="shrink-0 text-ink-muted" /></button> : <EmptyBlock title="Vamos registrar seu primeiro treino?" action={<Link to="/registrar" className="inline-link">Registrar treino<ArrowRight size={17} /></Link>}>Suas atividades e os números de cada treino ficam aqui.</EmptyBlock>}
        </section>
        <section className="tracking-panel home-day"><span className="small-label">Seu dia</span><h2>{checkedIn ? 'Dia registrado' : 'Como você está?'}</h2><p>{checkedIn ? 'Seu sono, alimentação e bem-estar ficam junto do seu histórico.' : 'Sono, alimentação e estado mental. Um check-in rápido, no seu tempo.'}</p><button className="btn-secondary" onClick={() => setCheckIn(true)}>{checkedIn && <CheckCircle size={19} weight="fill" />}{checkedIn ? 'Ver ou editar meu dia' : 'Registrar meu dia'}</button></section>
      </div>
    </>}
    {details && latest && <SessionDetails activity={latest} data={data} onClose={() => setDetails(false)} onSaved={() => { setDetails(false); setSaved('Treino atualizado. Seu progresso já está em dia.') }} />}
    {checkIn && <BottomSheet title="Como foi seu dia?" description={formatShortDate(data.today)} onClose={() => setCheckIn(false)}><CheckInForm date={data.today} log={todayLog} onSaved={() => { setCheckIn(false); setSaved('Dia salvo. Bom ter esse registro por aqui!') }} /></BottomSheet>}
  </main>
}
