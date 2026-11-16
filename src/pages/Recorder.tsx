import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle, Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import { useTracking } from '@/hooks/useTracking'
import SessionForm from '@/components/tracking/SessionForm'
import RoutineReviewForm from '@/components/tracking/RoutineReviewForm'
import DailyRegisterGrid from '@/components/tracking/DailyRegisterGrid'
import { addCalendarDays, isDateKey } from '@/lib/date'
import { TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'

function resolveRecordDate(requested: string | null, today: string) {
  const yesterday = addCalendarDays(today, -1)
  if (requested && isDateKey(requested) && requested <= today) return requested
  return yesterday
}

type DayView = 'grade' | 'formulario'

export default function Recorder() {
  const data = useTracking()
  const [params, setParams] = useSearchParams()
  const mode = params.get('modo') === 'treino' || params.has('atividade') || params.has('ficha') ? 'treino' : 'dia'
  const dayView: DayView = params.get('vista') === 'formulario' ? 'formulario' : 'grade'
  const [saved, setSaved] = useState(false)
  const [version, setVersion] = useState(0)
  const [date, setDate] = useState(() => resolveRecordDate(params.get('data'), data.today))

  const changeMode = (next: string) => {
    setSaved(false)
    setParams(current => {
      const nextParams = new URLSearchParams()
      nextParams.set('modo', next)
      const keepDate = current.get('data') ?? date
      if (keepDate) nextParams.set('data', keepDate)
      if (next === 'dia' && current.get('vista') === 'formulario') nextParams.set('vista', 'formulario')
      return nextParams
    })
    setVersion(current => current + 1)
  }

  const changeDayView = (next: DayView) => {
    setSaved(false)
    setParams(current => {
      const nextParams = new URLSearchParams(current)
      nextParams.set('modo', 'dia')
      if (next === 'formulario') nextParams.set('vista', 'formulario')
      else nextParams.delete('vista')
      return nextParams
    })
    setVersion(current => current + 1)
  }

  const wideDayGrid = mode === 'dia' && dayView === 'grade' && data.loaded && !data.error

  return (
    <main className={`page-content tracking-entry page-enter${wideDayGrid ? ' is-daily-grid' : ''}`}>
      <PageHeader
        title="Registrar"
        description={mode === 'dia' ? 'Grade rápida do mês ou formulário detalhado do dia.' : 'Registre o treino no seu ritmo.'}
      />
      <div className="entry-tabs" role="group" aria-label="O que registrar">
        <button aria-pressed={mode === 'treino'} onClick={() => changeMode('treino')}>Meu treino</button>
        <button aria-pressed={mode === 'dia'} onClick={() => changeMode('dia')}>Meu dia</button>
      </div>
      {mode === 'dia' && (
        <div className="entry-tabs daily-grid-view-tabs" role="group" aria-label="Como registrar o dia">
          <button aria-pressed={dayView === 'grade'} onClick={() => changeDayView('grade')}>Grade visual</button>
          <button aria-pressed={dayView === 'formulario'} onClick={() => changeDayView('formulario')}>Formulário</button>
        </div>
      )}
      {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : saved && mode === 'treino' ? (
        <section className="tracking-panel saved-panel" role="status">
          <span className="saved-illustration"><CheckCircle size={55} weight="fill" /></span>
          <h2>Treino registrado!</h2>
          <p>Seu histórico e seus gráficos já foram atualizados.</p>
          <Link to="/" className="btn-primary">Ver meu progresso<ArrowRight size={19} /></Link>
          <button className="btn-secondary" onClick={() => { setSaved(false); setVersion(current => current + 1) }}>
            <Plus size={18} />Registrar outra atividade
          </button>
          <Link to="/historico" className="inline-link">Abrir histórico</Link>
        </section>
      ) : saved && mode === 'dia' && dayView === 'formulario' ? (
        <section className="tracking-panel saved-panel" role="status">
          <span className="saved-illustration"><CheckCircle size={55} weight="fill" /></span>
          <h2>Seu dia está registrado!</h2>
          <p>Mais um registro para entender seu ritmo.</p>
          <Link to="/" className="btn-primary">Ver meu progresso<ArrowRight size={19} /></Link>
          <button className="btn-secondary" onClick={() => { setSaved(false); setVersion(current => current + 1) }}>
            <Plus size={18} />Editar meu dia
          </button>
          <button className="inline-link" onClick={() => changeDayView('grade')}>Ver grade do mês</button>
        </section>
      ) : mode === 'dia' && dayView === 'grade' ? (
        <DailyRegisterGrid data={data} />
      ) : (
        <section className="tracking-panel entry-panel">
          {mode === 'dia'
            ? (
              <RoutineReviewForm
                key={`${date}:${version}`}
                data={data}
                date={date}
                onSaved={() => setSaved(true)}
                onDateChange={setDate}
              />
            )
            : (
              <SessionForm
                key={`${date}:${version}`}
                data={data}
                defaultDate={date}
                defaultActivity={params.get('atividade') ?? undefined}
                defaultTemplateId={params.get('ficha') ?? undefined}
                onSaved={() => setSaved(true)}
              />
            )}
        </section>
      )}
    </main>
  )
}
