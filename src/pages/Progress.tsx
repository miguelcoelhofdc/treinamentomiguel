import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowClockwise,
  Barbell,
  ChartLineUp,
  CheckCircle,
  FloppyDisk,
  Plus,
  RoadHorizon,
  SpinnerGap,
  Target,
  Timer,
  TrendDown,
  TrendUp,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import ProgressRing from '@/components/ui/ProgressRing'
import WeightChart from '@/components/charts/WeightChart'
import PaceChart from '@/components/charts/PaceChart'
import RunningLogForm from '@/components/RunningLogForm'
import { getWeightHistory, getAllRunningLogs, getStrengthPRs, getDailyLog, saveDailyLog } from '@/db'
import plan from '@/data/plan.json'
import type { RunningLog, TestDefinition } from '@/types'

interface ProgressProps {
  initialWeight: number
  goalWeight: number
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

const revealStyle = (index: number) => ({ '--index': index } as CSSProperties)

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

function ChartEmpty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: () => void
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-start justify-center px-4 py-8 sm:px-8">
      <span className="icon-tile mb-4" aria-hidden="true">
        <ChartLineUp size={22} weight="duotone" />
      </span>
      <p className="text-body-md text-ink">{title}</p>
      <p className="mt-1 max-w-[34ch] text-[13px] leading-5 text-ink-muted">{description}</p>
      {action && (
        <button type="button" onClick={action} className="btn-secondary mt-5">
          <Plus size={18} weight="bold" />
          Registrar corrida
        </button>
      )}
    </div>
  )
}

function ProgressLoading() {
  return (
    <div className="page-content" aria-label="Carregando progresso" aria-busy="true">
      <PageHeader eyebrow="Performance" title="Progresso" description="Organizando seus registros mais recentes." />
      <div className="space-y-6">
        <div className="skeleton h-56 w-full rounded-[28px]" />
        <div className="grid grid-cols-2 gap-5 border-y border-line py-5">
          <div className="skeleton h-14" />
          <div className="skeleton h-14" />
        </div>
        <div className="skeleton h-72 w-full rounded-[22px]" />
        <div className="skeleton h-72 w-full rounded-[22px]" />
      </div>
    </div>
  )
}

export default function Progress({ initialWeight, goalWeight }: ProgressProps) {
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
    void load(true)
  }, [load])

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
  const weightProgress = calculateWeightProgress(initialWeight, goalWeight, currentWeight)
  const WeightTrendIcon = (weightDelta ?? 0) <= 0 ? TrendDown : TrendUp
  const weightTrendColor = weightDelta == null || weightDelta === 0
    ? 'text-white/70'
    : weightDelta < 0
      ? 'text-success'
      : 'text-danger'

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

  const weightChangeCopy = weightDelta == null
    ? 'Registre seu peso no Log do Dia para iniciar a curva.'
    : weightDelta === 0
      ? 'Você está no mesmo marco do início.'
      : `${weightFormatter.format(Math.abs(weightDelta))} kg ${weightDelta < 0 ? 'abaixo' : 'acima'} do início.`

  return (
    <div className="page-content page-enter">
      <PageHeader
        eyebrow="Performance"
        title="Progresso"
        description="O que mudou, onde você está e qual é o próximo marco."
        action={(
          <span className="icon-tile" aria-hidden="true">
            <ChartLineUp size={23} weight="duotone" />
          </span>
        )}
      />

      {loadError && (
        <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
          <WarningCircle size={21} weight="duotone" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Dados indisponíveis</p>
            <p className="mt-1 text-[13px] leading-5 opacity-80">{loadError}</p>
          </div>
          <button type="button" onClick={() => void load(true)} className="btn-icon -mr-2 -mt-2" aria-label="Tentar carregar novamente">
            <ArrowClockwise size={19} weight="bold" />
          </button>
        </div>
      )}

      <section className="hero-surface reveal-item p-5 sm:p-6" style={revealStyle(0)} aria-labelledby="weight-trajectory-title">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" />

        <div className="relative flex items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-white/55">Trajetória corporal</p>
            <h2 id="weight-trajectory-title" className="mt-4 flex items-baseline gap-2">
              <span className="text-[46px] font-semibold leading-none tracking-[-0.055em] text-white tabular-nums">
                {currentWeight == null ? '—' : weightFormatter.format(currentWeight)}
              </span>
              {currentWeight != null && <span className="text-[14px] font-semibold text-white/55">kg</span>}
            </h2>
            <p className="mt-3 flex max-w-[30ch] items-center gap-2 text-[13px] leading-5 text-white/70">
              {weightDelta != null && <WeightTrendIcon size={16} weight="bold" className={`shrink-0 ${weightTrendColor}`} />}
              {weightChangeCopy}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            <ProgressRing
              value={weightProgress}
              size={76}
              stroke={7}
              inverse
              label={currentWeight == null ? '—' : `${Math.round(weightProgress)}%`}
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">do caminho</span>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-4">
          <div className="pr-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Partida</p>
            <p className="mt-1 text-[17px] font-semibold text-white tabular-nums">{weightFormatter.format(initialWeight)} kg</p>
          </div>
          <div className="pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Meta</p>
            <p className="mt-1 text-[17px] font-semibold text-white tabular-nums">{weightFormatter.format(goalWeight)} kg</p>
          </div>
        </div>
      </section>

      <section
        className="reveal-item mt-6 grid grid-cols-2 divide-x divide-line border-y border-line py-5"
        style={revealStyle(1)}
        aria-label="Resumo de corrida"
      >
        <div className="flex min-w-0 items-start gap-3 pr-4">
          <RoadHorizon size={21} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="metric-number text-[26px] leading-none">{distanceFormatter.format(totalKm)}</p>
            <p className="mt-1.5 text-[12px] leading-4 text-ink-muted">km em {runData.length} {runData.length === 1 ? 'sessão' : 'sessões'}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-3 pl-4">
          <Timer size={21} weight="duotone" className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="metric-number text-[26px] leading-none">{formatPace(bestPace)}</p>
            <p className="mt-1.5 text-[12px] leading-4 text-ink-muted">melhor pace de qualidade</p>
          </div>
        </div>
      </section>

      <section className="reveal-item mt-8" style={revealStyle(2)} aria-labelledby="weight-chart-title">
        <div className="section-heading">
          <div>
            <h2 id="weight-chart-title">Peso corporal</h2>
            <p>Tendência dos registros feitos pela manhã.</p>
          </div>
          <span className="badge-fase shrink-0 gap-1.5">
            <Target size={13} weight="bold" />
            {weightFormatter.format(goalWeight)} kg
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-line/85 bg-surface px-2 py-4 sm:px-4">
          {sortedWeights.length === 0
            ? <ChartEmpty title="Sua curva começa no primeiro registro" description="Adicione o peso no Log do Dia e acompanhe a direção ao longo das semanas." />
            : <WeightChart data={sortedWeights} goal={goalWeight} initial={initialWeight} />}
        </div>
      </section>

      <section className="reveal-item mt-8" style={revealStyle(3)} aria-labelledby="pace-chart-title">
        <div className="section-heading">
          <div>
            <h2 id="pace-chart-title">Ritmo de corrida</h2>
            <p>Compare qualidade e longa na mesma linha do tempo.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowRunForm((visible) => !visible)}
            className="btn-ghost -mr-2 shrink-0 text-accent-strong"
            aria-expanded={showRunForm}
            aria-controls="running-log-form"
          >
            {showRunForm ? <X size={17} weight="bold" /> : <Plus size={17} weight="bold" />}
            {showRunForm ? 'Fechar' : 'Registrar'}
          </button>
        </div>

        {showRunForm && (
          <div id="running-log-form" className="mt-4 rounded-[22px] border border-line/85 bg-surface p-4 sm:p-5">
            <p className="section-title">Nova corrida</p>
            <RunningLogForm onSaved={() => { setShowRunForm(false); void load() }} />
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-[22px] border border-line/85 bg-surface px-2 py-4 sm:px-4">
          {chartableRuns.length === 0
            ? (
              <ChartEmpty
                title="Ainda não há pace comparável"
                description="Registre uma corrida de qualidade ou uma longa para formar sua linha de evolução."
                action={() => setShowRunForm(true)}
              />
            )
            : <PaceChart data={chartableRuns} />}
        </div>
      </section>

      {strengthRecords.length > 0 && (
        <section className="reveal-item mt-9" style={revealStyle(4)} aria-labelledby="strength-title">
          <div className="section-heading mb-4">
            <div>
              <h2 id="strength-title" className="flex items-center gap-2">
                <Barbell size={20} weight="duotone" className="text-accent" />
                Recordes de força
              </h2>
              <p>Melhores cargas registradas por exercício.</p>
            </div>
          </div>
          <div className="list-surface divide-y divide-line">
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
        </section>
      )}

      <section className="reveal-item mt-9" style={revealStyle(5)} aria-labelledby="tests-title">
        <div className="section-heading mb-4">
          <div>
            <h2 id="tests-title">Testes de performance</h2>
            <p>Atualize cada marco e compare com sua linha inicial.</p>
          </div>
        </div>

        <div className="list-surface divide-y divide-line">
          {(plan.tests as TestDefinition[]).map((test) => {
            const currentValue = testValues[test.id] ?? ''
            const comparison = compareTestValue(currentValue, test)
            const status = testStatus[test.id] ?? 'idle'
            const error = testErrors[test.id]
            const inputId = `test-${test.id}`
            const helperId = `${inputId}-helper`

            return (
              <div key={test.id} className="px-4 py-5 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">{test.name}</p>
                    <p className="mt-1 text-[12px] leading-4 text-ink-muted">
                      Inicial {test.initial} {test.unit} · meta {test.target} {test.unit}
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
      </section>
    </div>
  )
}
