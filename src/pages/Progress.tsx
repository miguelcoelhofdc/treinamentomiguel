import { Link, useSearchParams } from 'react-router-dom'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import SegmentTabs from '@/components/ui/SegmentTabs'
import BottomSheet from '@/components/ui/BottomSheet'
import DailyLogForm from '@/components/DailyLogForm'
import { AchievementsPanel } from '@/components/journey/Achievements'
import WellnessDetails from '@/components/progress/WellnessDetails'
import ActivityHistory from '@/components/progress/ActivityHistory'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle,
  FloppyDisk,
  Plus,
  SpinnerGap,
  TrendUp,
  WarningCircle,
} from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import WeightChart from '@/components/charts/WeightChart'
import PaceChart from '@/components/charts/PaceChart'
import RunningLogForm from '@/components/RunningLogForm'
import { getWeightHistory, getAllRunningLogs, getStrengthPRs, getDailyLog, saveDailyLog } from '@/db'
import plan from '@/data/activePlan'
import type { RunningLog, TestDefinition, TrainingSettings } from '@/types'
import GoalEditor from '@/components/journey/GoalEditor'
import GoalCard from '@/components/journey/GoalCard'
import ActivityRecorder from '@/components/journey/ActivityRecorder'
import { goalProgress, goalUnit } from '@/lib/continuousTraining'
import { useJourney } from '@/hooks/useJourney'
import { effectiveTarget, hasCheckIn } from '@/lib/journey'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'

interface ProgressProps {
  initialWeight: number
  goalWeight: number
  settings: TrainingSettings
  updateSetting: UpdateTrainingSetting
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type Comparison = 'improved' | 'same' | 'declined' | null

const weightFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const distanceFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})


function formatPace(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—'
  const totalSeconds = Math.round(value * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date
}

function calculateWeightProgress(initial: number, goal: number, current?: number) {
  if (current == null || !Number.isFinite(current)) return 0
  const totalDistance = Math.abs(goal - initial)
  if (totalDistance === 0) return Math.abs(current - goal) < 0.05 ? 100 : 0

  const travelled = goal < initial ? initial - current : current - initial
  return Math.max(0, Math.min(100, (travelled / totalDistance) * 100))
}

function parseComparableValue(value: string | number, unit: string): number | null {
  const raw = String(value).trim()
  if (!raw) return null

  if (unit === 'min:seg') {
    const match = /^(\d+):([0-5]?\d)$/.exec(raw)
    if (!match) return null
    return Number(match[1]) * 60 + Number(match[2])
  }

  const normalized = raw.replace(',', '.')
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function compareTestValue(current: string | undefined, test: TestDefinition): Comparison {
  if (!current?.trim()) return null
  const currentValue = parseComparableValue(current, test.unit)
  const initialValue = parseComparableValue(test.initial, test.unit)
  if (currentValue == null || initialValue == null) return null
  if (currentValue === initialValue) return 'same'
  return test.lower === (currentValue < initialValue) ? 'improved' : 'declined'
}

function sanitizeTestValues(notes?: string) {
  if (!notes) return {}

  try {
    const parsed: unknown = JSON.parse(notes)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.entries(parsed).reduce<Record<string, string>>((values, [key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') values[key] = String(value)
      return values
    }, {})
  } catch {
    return {}
  }
}

function ProgressLoading() {
  return <main className="page-content" aria-label="Carregando evolução" aria-busy="true"><PageHeader title="Evolução" description="Seu progresso, no seu ritmo." /><div className="skeleton h-12 mb-8" /><div className="skeleton h-32 mb-8" /><div className="skeleton h-16" /></main>
}

export default function Progress({ initialWeight, goalWeight, settings, updateSetting }: ProgressProps) {
  const journey = useJourney(settings.startDate)
  const [searchParams, setSearchParams] = useSearchParams()
  const sections = [{ id: 'resumo', label: 'Resumo' }, { id: 'saude', label: 'Saúde' }, { id: 'historico', label: 'Histórico' }, { id: 'metas', label: 'Metas' }]
  const requestedSection = searchParams.get('aba') ?? 'resumo'
  const section = sections.some(item => item.id === requestedSection) ? requestedSection : 'resumo'
  const [showWellness, setShowWellness] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [weightData, setWeightData] = useState<{ date: string; weight: number }[]>([])
  const [runData, setRunData] = useState<RunningLog[]>([])
  const [prs, setPrs] = useState<Map<string, { weightKg: number; reps: number; date: string }>>(new Map())
  const [showRunForm, setShowRunForm] = useState(false)
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [testStatus, setTestStatus] = useState<Record<string, SaveStatus>>({})
  const [testErrors, setTestErrors] = useState<Record<string, string | undefined>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true)
    setLoadError(null)

    try {
      const [weights, runs, strengthRecords, testLog] = await Promise.all([
        getWeightHistory(),
        getAllRunningLogs(),
        getStrengthPRs(),
        getDailyLog('__tests__'),
      ])
      setWeightData(weights)
      setRunData(runs)
      setPrs(strengthRecords)
      setTestValues(sanitizeTestValues(testLog?.notes))
    } catch {
      setLoadError('Não foi possível atualizar seus dados agora. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, journey.logs, journey.activities])

  const sortedWeights = useMemo(
    () => [...weightData].sort((a, b) => a.date.localeCompare(b.date)),
    [weightData],
  )

  const currentWeight = sortedWeights.length > 0
    ? sortedWeights[sortedWeights.length - 1].weight
    : undefined

  const qualityPaces = useMemo(
    () => runData
      .filter((run) => run.type === 'qualidade' && Number.isFinite(run.paceMinKm) && (run.paceMinKm ?? 0) > 0)
      .map((run) => run.paceMinKm as number),
    [runData],
  )

  const chartableRuns = useMemo(
    () => runData.filter((run) =>
      (run.type === 'qualidade' || run.type === 'longa')
      && Number.isFinite(run.paceMinKm)
      && (run.paceMinKm ?? 0) > 0,
    ),
    [runData],
  )

  const bestPace = qualityPaces.length > 0 ? Math.min(...qualityPaces) : null
  const totalKm = runData.reduce(
    (sum, run) => sum + (Number.isFinite(run.distanceKm) && run.distanceKm > 0 ? run.distanceKm : 0),
    0,
  )
  const weightDelta = currentWeight == null ? null : currentWeight - initialWeight
  const activeWeightGoal = settings.primaryGoal?.kind === 'weight' ? settings.primaryGoal.target : undefined
  const weightProgress = activeWeightGoal == null ? 0 : calculateWeightProgress(initialWeight, activeWeightGoal, currentWeight)

  const strengthRecords = useMemo(
    () => Array.from(prs.entries()).sort(([nameA], [nameB]) => nameA.localeCompare(nameB, 'pt-BR')),
    [prs],
  )

  const saveTestValue = async (test: TestDefinition) => {
    const rawValue = testValues[test.id]?.trim() ?? ''
    const parsedValue = parseComparableValue(rawValue, test.unit)

    if (parsedValue == null) {
      setTestStatus((status) => ({ ...status, [test.id]: 'error' }))
      setTestErrors((errors) => ({
        ...errors,
        [test.id]: test.unit === 'min:seg' ? 'Use o formato min:seg, por exemplo 28:45.' : 'Informe um número válido.',
      }))
      return
    }

    setTestStatus((status) => ({ ...status, [test.id]: 'saving' }))
    setTestErrors((errors) => ({ ...errors, [test.id]: undefined }))

    try {
      await saveDailyLog({ date: '__tests__', notes: JSON.stringify(testValues) })
      setTestStatus((status) => ({ ...status, [test.id]: 'saved' }))
    } catch {
      setTestStatus((status) => ({ ...status, [test.id]: 'error' }))
      setTestErrors((errors) => ({ ...errors, [test.id]: 'Não foi possível salvar. Tente novamente.' }))
    }
  }

  if (loading) return <ProgressLoading />
  const latestWeight = sortedWeights.at(-1)
  const wellness = [...journey.stats.byDate.values()].filter(hasCheckIn).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const minutes = Math.round(journey.activities.reduce((sum, item) => sum + (item.durationMin ?? 0), 0))
  const changeSection = (next: string) => setSearchParams(previous => { const params = new URLSearchParams(previous); params.set('aba', next); return params })
  return <main className="page-content page-enter">
    <PageHeader title="Evolução" description="Seu progresso, no seu ritmo." />
    <div className="evolution-tabs"><SegmentTabs id="evolution" tabs={sections} active={section} onChange={changeSection} ariaLabel="Áreas de evolução" /></div>
    {loadError && <div role="alert" className="subtle-alert mb-6"><WarningCircle size={20} className="shrink-0 text-red-600" /><div className="flex-1"><p>{loadError}</p><button className="btn-ghost mt-2" onClick={() => void load()}>Tentar novamente</button></div></div>}
    {journey.error && <div role="alert" className="subtle-alert mb-6"><p>Não foi possível carregar as atividades.</p><button className="btn-ghost" onClick={journey.retry}>Tentar novamente</button></div>}
    <div role="tabpanel" id="evolution-panel" aria-labelledby={'evolution-tab-' + section}>
    {section === 'resumo' && <>
      <section className="evolution-metric" aria-label="Resumo da sua evolução"><p className="page-kicker mb-3">Seu movimento até aqui</p><h2 className="evolution-metric-value">{journey.loaded ? journey.stats.workouts : '—'}</h2><p className="evolution-metric-label">dias ativos</p><p className="mt-4 text-[14px] text-ink-muted">{minutes.toLocaleString('pt-BR')} minutos registrados</p><div className="mt-5"><ActivityRecorder settings={settings} updateSetting={updateSetting} primary /></div></section>
      <CollapsiblePanel id="running-progress" title="Corrida" description="Distância, ritmo e registros">
        <div className="flex flex-wrap gap-6 mb-6"><div><p className="text-[24px] font-medium">{distanceFormatter.format(totalKm)} km</p><p className="helper">{runData.length} sessões</p></div><div><p className="text-[24px] font-medium">{formatPace(bestPace)}</p><p className="helper">Melhor pace de qualidade · min/km</p></div></div>
        {chartableRuns.length ? <PaceChart data={chartableRuns} /> : <div className="state-block"><h2>Ainda não há pace comparável</h2><p>Registre uma corrida de qualidade ou longa para acompanhar o ritmo.</p></div>}
        <button className="btn-secondary mt-4" onClick={() => setShowRunForm(true)}><Plus size={18} />Registrar corrida</button>
      </CollapsiblePanel>
      {strengthRecords.length > 0 && <CollapsiblePanel id="strength-progress" title="Recordes de força" description="Melhores cargas por exercício">
          <div className="open-list divide-y divide-line">
            {strengthRecords.map(([exercise, record]) => (
              <div key={exercise} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink">{exercise}</p>
                  <p className="mt-1 text-[12px] text-ink-muted">{formatDate(record.date)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="metric-number text-[19px] text-accent-strong">{weightFormatter.format(record.weightKg)} kg</p>
                  <p className="mt-0.5 text-[12px] text-ink-muted">{record.reps} {record.reps === 1 ? 'repetição' : 'repetições'}</p>
                </div>
              </div>
            ))}
          </div>
      </CollapsiblePanel>}
      <CollapsiblePanel id="performance-tests" title="Testes de performance" description="Consultar e atualizar seus resultados">
        <div className="open-list divide-y divide-line">
          {(plan.tests as TestDefinition[]).map((test) => {
            const currentValue = testValues[test.id] ?? ''
            const comparison = compareTestValue(currentValue, test)
            const status = testStatus[test.id] ?? 'idle'
            const error = testErrors[test.id]
            const inputId = `test-${test.id}`
            const helperId = `${inputId}-helper`
            const target = effectiveTarget(test, settings.performanceTargets, goalWeight)

            return (
              <div key={test.id} className="px-4 py-5 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">{test.name}</p>
                    <p className="mt-1 text-[12px] leading-4 text-ink-muted">
                      Inicial {test.initial} {test.unit} · referência {target} {test.unit}
                    </p>
                  </div>
                  {comparison && (
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      comparison === 'improved'
                        ? 'bg-success-light text-success-dark dark:bg-success/15 dark:text-success'
                        : 'bg-surface-raised text-ink-muted'
                    }`}>
                      {comparison === 'improved' && <TrendUp size={13} weight="bold" />}
                      {comparison === 'improved' ? 'Evoluiu' : comparison === 'same' ? 'No início' : 'A recuperar'}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[13px] leading-5 text-ink-soft">{test.description}</p>

                <div className="mt-4">
                  <label htmlFor={inputId} className="label">Resultado atual</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      id={inputId}
                      type="text"
                      inputMode={test.unit === 'min:seg' ? 'text' : 'decimal'}
                      className="input min-w-0"
                      placeholder={test.unit === 'min:seg' ? 'ex: 28:45' : `Valor em ${test.unit}`}
                      value={currentValue}
                      aria-describedby={helperId}
                      aria-invalid={Boolean(error)}
                      onChange={(event) => {
                        const value = event.target.value
                        setTestValues((values) => ({ ...values, [test.id]: value }))
                        setTestStatus((statuses) => ({ ...statuses, [test.id]: 'idle' }))
                        setTestErrors((errors) => ({ ...errors, [test.id]: undefined }))
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void saveTestValue(test)}
                      className="btn-secondary min-w-[102px] px-3"
                      disabled={status === 'saving'}
                      aria-live="polite"
                    >
                      {status === 'saving' && <SpinnerGap size={17} weight="bold" className="animate-spin" />}
                      {status === 'saved' && <CheckCircle size={17} weight="fill" className="text-accent" />}
                      {(status === 'idle' || status === 'error') && <FloppyDisk size={17} weight="bold" />}
                      {status === 'saving' ? 'Salvando' : status === 'saved' ? 'Salvo' : 'Salvar'}
                    </button>
                  </div>
                  <p
                    id={helperId}
                    className={`mt-2 text-[12px] leading-4 ${error ? 'text-red-700 dark:text-red-300' : 'text-ink-muted'}`}
                    role={error ? 'alert' : undefined}
                  >
                    {error ?? (test.unit === 'min:seg' ? 'Use minutos e segundos separados por dois-pontos.' : 'Aceita ponto ou vírgula decimal.')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CollapsiblePanel>
      <CollapsiblePanel id="consistency-progress" title="Constância e conquistas" description="Pequenos passos que se acumulam">
        <dl className="health-details"><div><dt>Sequência atual</dt><dd>{journey.stats.streak} dias</dd></div><div><dt>Melhor sequência</dt><dd>{journey.stats.bestStreak} dias</dd></div><div><dt>Conquistas</dt><dd>{journey.stats.unlocked.length} de 8</dd></div></dl><button className="btn-secondary mt-6" onClick={() => setShowAchievements(true)}>Ver conquistas</button>
      </CollapsiblePanel>
    </>}
    {section === 'saude' && <>
      <section className="evolution-metric" aria-labelledby="weight-title"><h2 id="weight-title" className="page-kicker mb-3">Peso corporal</h2><div className="health-reading"><p className="evolution-metric-value">{currentWeight == null ? '—' : weightFormatter.format(currentWeight)}</p>{currentWeight != null && <span className="text-ink-muted">kg</span>}</div><p className="evolution-metric-label">{latestWeight ? 'Registrado em ' + formatDate(latestWeight.date) : 'Seu acompanhamento começa no primeiro registro.'}</p><button className="btn-primary mt-6" onClick={() => setShowWellness(true)}>Atualizar check-in</button></section>
      <CollapsiblePanel id="weight-history" title="Evolução do peso" description="Tendência e referências">
        {sortedWeights.length ? <WeightChart data={sortedWeights} goal={activeWeightGoal} initial={initialWeight} /> : <div className="state-block"><h2>Sua curva começa no primeiro registro</h2><p>Adicione seu peso nos detalhes do check-in.</p></div>}
        <dl className="health-details mt-6"><div><dt>Peso inicial</dt><dd>{weightFormatter.format(initialWeight)} kg</dd></div>{activeWeightGoal != null && <div><dt>Meta escolhida</dt><dd>{weightFormatter.format(activeWeightGoal)} kg</dd></div>}</dl>
        {weightDelta != null && <p className="helper mt-4">{weightFormatter.format(Math.abs(weightDelta))} kg {weightDelta < 0 ? 'abaixo' : weightDelta > 0 ? 'acima' : 'de diferença'} do início.</p>}
        {activeWeightGoal != null && currentWeight != null && <p className="helper">{Math.round(weightProgress)}% do caminho até a meta.</p>}
      </CollapsiblePanel>
      <CollapsiblePanel id="wellness-details" title="Último check-in" description={wellness ? 'Registrado em ' + formatDate(wellness.date) : 'Sono, energia e sinais do corpo'}><WellnessDetails log={wellness} /></CollapsiblePanel>
    </>}
    {section === 'historico' && <>
      <div className="flex items-center justify-between gap-4 mb-4"><h2 className="text-[20px] font-semibold">Suas atividades</h2><ActivityRecorder settings={settings} updateSetting={updateSetting} /></div>
      {journey.activities.length ? <ActivityHistory activities={journey.activities} /> : <div className="state-block"><h2>Seu histórico começa com um passo</h2><p>Registre uma atividade ou conclua seu treino. Os registros aparecerão aqui.</p><Link to="/hoje" className="btn-secondary">Abrir treino</Link></div>}
    </>}
    {section === 'metas' && <>
      <GoalCard settings={settings} updateSetting={updateSetting} activities={journey.activities} logs={journey.logs} today={journey.today} editable={false} />
      <div className="mb-8"><GoalEditor settings={settings} updateSetting={updateSetting} /></div>
      {settings.goalHistory.length > 0 && <CollapsiblePanel id="previous-goals" title="Metas anteriores" description="O caminho que você já percorreu"><ol className="divide-y divide-line">{[...settings.goalHistory].reverse().map(goal => { const result = goalProgress(goal, journey.activities, journey.logs, journey.today); return <li key={goal.id} className="py-4"><p className="text-[16px] font-medium">{goal.title}</p><p className="helper">{result.current == null ? 'Sem resultado registrado' : result.current.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' ' + goalUnit(goal)} · alvo {goal.target} {goalUnit(goal)} · {result.achieved ? 'Alcançada' : 'Encerrada'}</p></li> })}</ol></CollapsiblePanel>}
    </>}
    </div>
    {showRunForm && <BottomSheet title="Registrar corrida" onClose={() => setShowRunForm(false)}><RunningLogForm onSaved={() => { setShowRunForm(false); void load() }} /></BottomSheet>}
    {showWellness && <BottomSheet title="Seu check-in de hoje" onClose={() => setShowWellness(false)}><DailyLogForm date={journey.today} onSaved={() => setShowWellness(false)} /></BottomSheet>}
    {showAchievements && <AchievementsPanel unlocked={journey.stats.unlocked} onClose={() => setShowAchievements(false)} />}
  </main>
}
