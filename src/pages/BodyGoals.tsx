import { useState } from 'react'
import { Barbell, Flag, PencilSimple, Plus, Scales, Target } from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import PageHeader from '@/components/ui/PageHeader'
import { BodyGoalForm, BodyMeasurementForm } from '@/components/tracking/BodyGoalForms'
import { goalDate, GoalProgressMeter, goalStatusLabel, GoalTiming, goalTitle, goalTimeLabel } from '@/components/tracking/BodyGoalDetails'
import { SavedNotice, TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'
import { useTracking } from '@/hooks/useTracking'
import { BODY_GOAL_FIELDS, type BodyGoalProgress, type BodyMeasurementField } from '@/lib/bodyGoals'
import { numberLabel } from '@/lib/tracking'
import type { BodyGoal } from '@/types'

type Editor = { kind: 'goal'; goal?: BodyGoal } | { kind: 'measurement'; field: BodyMeasurementField }

function ActiveGoalCard({ progress, onEdit, onMeasure }: {
  progress: BodyGoalProgress
  onEdit: () => void
  onMeasure: () => void
}) {
  const { goal, current, currentKg, status, targetKg } = progress
  const Icon = goal.type === 'weightLoss' ? Scales : Barbell
  return (
    <article className="body-goal-card">
      <header className="body-goal-card-header">
        <span className="body-goal-icon" aria-hidden="true"><Icon size={24} weight="duotone" /></span>
        <div>
          <h3>{goalTitle(goal)}</h3>
          <p>Início em <time dateTime={goal.startDate}>{goalDate(goal.startDate)}</time></p>
        </div>
        <span className={`body-goal-status is-${status}`}>{goalStatusLabel(status)}</span>
      </header>
      <div className="body-goal-card-content">
        <div className="body-goal-card-main">
          <GoalProgressMeter progress={progress} />
          <dl className="body-goal-readings">
            <div><dt>Início</dt><dd>{numberLabel(goal.baselineKg)} kg</dd></div>
            <div>
              <dt>Última medição</dt>
              <dd>{current ? `${numberLabel(currentKg)} kg` : '—'}</dd>
              {current && <small><time dateTime={current.date}>{goalDate(current.date)}</time></small>}
            </div>
            <div><dt>Alvo</dt><dd>{numberLabel(targetKg)} kg</dd></div>
          </dl>
        </div>
        <GoalTiming progress={progress} />
      </div>
      {status === 'active' && (
        <footer className="body-goal-card-actions">
          <button className="btn-secondary" type="button" onClick={onMeasure}><Plus size={17} aria-hidden="true" />{goal.type === 'weightLoss' ? 'Registrar peso' : 'Registrar massa magra'}</button>
          <button className="inline-link" type="button" onClick={onEdit}><PencilSimple size={17} aria-hidden="true" />Editar meta</button>
        </footer>
      )}
    </article>
  )
}

function GoalHistory({ history }: { history: BodyGoalProgress[] }) {
  return (
    <section className="body-goal-section" aria-labelledby="body-goal-history">
      <h2 id="body-goal-history">Histórico</h2>
      <ul className="body-goal-history-list">
        {history.map(progress => (
          <li key={progress.goal.id} className="body-goal-history-item">
            <span className="body-goal-icon" aria-hidden="true"><Flag size={21} weight="duotone" /></span>
            <div>
              <h3>{goalTitle(progress.goal)}</h3>
              <p>{goalTimeLabel(progress)}</p>
            </div>
            <span className={`body-goal-status is-${progress.status}`}>{progress.percent}% concluído</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function BodyGoals() {
  const data = useTracking()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notice, setNotice] = useState('')
  const { open, history } = data.personalGoals
  const ready = data.loaded && !data.error
  const createGoal = () => setEditor({ kind: 'goal' })
  const recordMeasurement = (field: BodyMeasurementField) => setEditor({ kind: 'measurement', field })
  const saved = (message: string) => { setEditor(null); setNotice(message) }

  return (
    <main className="page-content body-goals-page">
      <PageHeader
        title="Metas"
        description="Escolha seu objetivo, defina o prazo e acompanhe a evolução em quilos."
        action={ready && (open.length > 0 || history.length > 0) ? (
          <button className="btn-primary" type="button" onClick={createGoal}><Plus size={20} aria-hidden="true" />Nova meta</button>
        ) : undefined}
      />
      {notice && <SavedNotice>{notice}</SavedNotice>}
      {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : (
        <>
          {!open.length && (
            <section className="body-goal-empty" aria-labelledby="body-goal-empty-title">
              <span className="body-goal-icon" aria-hidden="true"><Target size={30} weight="duotone" /></span>
              <h2 id="body-goal-empty-title">{history.length ? 'Nenhuma meta em andamento' : 'Qual é sua próxima meta?'}</h2>
              <p>{history.length ? 'Defina um novo objetivo para continuar acompanhando sua evolução.' : 'Defina quantos quilos quer perder ou ganhar de massa magra e até quando.'}</p>
              <button className="btn-primary" type="button" onClick={createGoal}><Plus size={19} aria-hidden="true" />{history.length ? 'Criar nova meta' : 'Criar primeira meta'}</button>
            </section>
          )}
          {open.length > 0 && (
            <section className="body-goal-section" aria-labelledby="body-goal-open">
              <h2 id="body-goal-open">Metas abertas</h2>
              <div className="body-goal-list">
                {open.map(progress => (
                  <ActiveGoalCard
                    key={progress.goal.id}
                    progress={progress}
                    onEdit={() => setEditor({ kind: 'goal', goal: progress.goal })}
                    onMeasure={() => recordMeasurement(BODY_GOAL_FIELDS[progress.goal.type])}
                  />
                ))}
              </div>
            </section>
          )}
          {history.length > 0 && <GoalHistory history={history} />}
          <button className="inline-link body-goal-standalone-measurement" type="button" onClick={() => recordMeasurement('weightKg')}>
            <Scales size={18} aria-hidden="true" /> Registrar medição avulsa
          </button>
        </>
      )}
      {editor?.kind === 'goal' && (
        <BottomSheet title={editor.goal ? 'Editar meta' : 'Nova meta'} onClose={() => setEditor(null)}>
          <BodyGoalForm data={data} goal={editor.goal} onSaved={() => saved(editor.goal ? 'Meta atualizada.' : 'Meta criada.')} />
        </BottomSheet>
      )}
      {editor?.kind === 'measurement' && (
        <BottomSheet title="Registrar medição" onClose={() => setEditor(null)}>
          <BodyMeasurementForm data={data} initialField={editor.field} onSaved={() => saved('Medição salva.')} />
        </BottomSheet>
      )}
    </main>
  )
}
