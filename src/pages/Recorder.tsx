import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle, Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import { useTracking } from '@/hooks/useTracking'
import SessionForm from '@/components/tracking/SessionForm'
import RoutineReviewForm from '@/components/tracking/RoutineReviewForm'
import { isDateKey } from '@/lib/date'
import { TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'

export default function Recorder() {
  const data = useTracking()
  const [params, setParams] = useSearchParams()
  const mode = params.get('modo') === 'treino' || params.has('atividade') || params.has('ficha') ? 'treino' : 'dia'
  const [saved, setSaved] = useState(false)
  const [version, setVersion] = useState(0)
  const requestedDate = params.get('data') ?? data.today
  const [date, setDate] = useState(isDateKey(requestedDate) && requestedDate <= data.today ? requestedDate : data.today)
  const changeMode = (next: string) => { setSaved(false); setParams({ modo: next }); setVersion(current => current + 1) }
  return <main className="page-content tracking-entry page-enter">
    <PageHeader title="Registrar" description="Conte o que você fez. Os números ficam com você." />
    <div className="entry-tabs" role="group" aria-label="O que registrar"><button aria-pressed={mode === 'treino'} onClick={() => changeMode('treino')}>Meu treino</button><button aria-pressed={mode === 'dia'} onClick={() => changeMode('dia')}>Meu dia</button></div>
    {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : saved ? <section className="tracking-panel saved-panel" role="status"><span className="saved-illustration"><CheckCircle size={55} weight="fill" /></span><h2>{mode === 'dia' ? 'Seu dia está registrado!' : 'Treino registrado!'}</h2><p>{mode === 'dia' ? 'Mais um registro para entender seu ritmo.' : 'Seu histórico e seus gráficos já foram atualizados.'}</p><Link to="/" className="btn-primary">Ver meu progresso<ArrowRight size={19} /></Link><button className="btn-secondary" onClick={() => { setSaved(false); setVersion(current => current + 1) }}><Plus size={18} />{mode === 'dia' ? 'Editar meu dia' : 'Registrar outra atividade'}</button><Link to="/historico" className="inline-link">Abrir histórico</Link></section> : <section className="tracking-panel entry-panel">
      {mode === 'dia' ? <RoutineReviewForm key={`${date}:${version}`} data={data} date={date} onSaved={() => setSaved(true)} onDateChange={setDate} /> : <SessionForm key={version} data={data} defaultDate={date} defaultActivity={params.get('atividade') ?? undefined} defaultTemplateId={params.get('ficha') ?? undefined} onSaved={() => setSaved(true)} />}
    </section>}
  </main>
}
