import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretLeft,
  CaretRight,
  Check,
  Smiley,
  SmileyMeh,
  SmileySad,
  SmileyWink,
  SmileyXEyes,
} from '@phosphor-icons/react'
import type { TrackingData } from '@/hooks/useTracking'
import { saveRoutineValues } from '@/db/routines'
import {
  addCalendarDays,
  formatDayLabel,
  formatShortDate,
  monthBounds,
  monthKey,
} from '@/lib/date'
import { readingLabel, routineReading } from '@/lib/routines'
import {
  STATUS_SCALE,
  cellEditMode,
  dayRegisterTargets,
  gridRoutines,
  monthDates,
  monthStatusSummary,
  percent,
  readingToStatus,
  statusLabel,
  statusToSaveValue,
  type StatusLevel,
} from '@/lib/routineStatus'
import type { RoutineDefinition } from '@/types'
import BottomSheet from '@/components/ui/BottomSheet'
import RoutineReviewForm from './RoutineReviewForm'

const FACE_ICONS = [SmileyXEyes, SmileySad, SmileyMeh, Smiley, SmileyWink] as const
type DraftMap = Record<string, StatusLevel | null>

function FaceIcon({ level, size = 15 }: { level: StatusLevel | null; size?: number }) {
  if (!level) return null
  const Icon = FACE_ICONS[level - 1]
  return <Icon size={size} weight="fill" aria-hidden="true" />
}

function SummaryCard({
  tone,
  label,
  count,
  share,
  face,
}: {
  tone: 'otimo' | 'regular' | 'ruim' | 'total'
  label: string
  count: number
  share?: number
  face?: StatusLevel
}) {
  return (
    <article className={`daily-grid-summary-card is-${tone}`}>
      <span className="daily-grid-summary-mark" aria-hidden="true">
        {face ? <FaceIcon level={face} size={20} /> : null}
      </span>
      <h2>{label}</h2>
      <strong>{share != null ? `${share}%` : count}</strong>
      <p>{share != null ? `${count} registro${count === 1 ? '' : 's'}` : 'no mês'}</p>
    </article>
  )
}

function FaceScale({
  routine,
  level,
  disabled,
  onPick,
}: {
  routine: RoutineDefinition
  level: StatusLevel | null
  disabled?: boolean
  onPick: (next: StatusLevel | null) => void
}) {
  return (
    <div className="daily-day-faces" role="group" aria-label={`Como foi ${routine.name}`}>
      {STATUS_SCALE.map((item, index) => {
        const Face = FACE_ICONS[index]
        const selected = level === item.level
        return (
          <button
            key={item.level}
            type="button"
            className={`daily-day-face is-level-${item.level}${selected ? ' is-selected' : ''}`}
            aria-pressed={selected}
            aria-label={item.label}
            disabled={disabled}
            onClick={() => onPick(selected ? null : item.level)}
          >
            <Face size={20} weight={selected ? 'fill' : 'regular'} aria-hidden="true" />
            <span>{item.short}</span>
          </button>
        )
      })}
    </div>
  )
}

function BinaryScale({
  routine,
  level,
  disabled,
  onPick,
}: {
  routine: RoutineDefinition
  level: StatusLevel | null
  disabled?: boolean
  onPick: (next: StatusLevel | null) => void
}) {
  const options = [
    { level: 1 as StatusLevel, label: 'Não fiz', Face: SmileySad },
    { level: 5 as StatusLevel, label: 'Feito', Face: Smiley },
  ]
  return (
    <div className="daily-day-faces is-binary" role="group" aria-label={routine.name}>
      {options.map(option => {
        const selected = level === option.level
        return (
          <button
            key={option.level}
            type="button"
            className={`daily-day-face is-level-${option.level}${selected ? ' is-selected' : ''}`}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onPick(selected ? null : option.level)}
          >
            <option.Face size={20} weight={selected ? 'fill' : 'regular'} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function dayHeading(date: string, today: string) {
  if (date === today) return 'Hoje'
  if (date === addCalendarDays(today, -1)) return 'Ontem'
  return formatDayLabel(date)
}

function readDraft(targets: RoutineDefinition[], date: string, data: TrackingData): DraftMap {
  return Object.fromEntries(
    targets
      .filter(routine => cellEditMode(routine.kind) !== 'value')
      .map(routine => [routine.id, readingToStatus(routine, routineReading(routine, date, data))]),
  )
}

function sameDraft(a: DraftMap, b: DraftMap) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if ((a[key] ?? null) !== (b[key] ?? null)) return false
  }
  return true
}

export default function DailyRegisterGrid({
  data,
  onSaved,
}: {
  data: TrackingData
  onSaved?: () => void
}) {
  const routines = useMemo(() => gridRoutines(data.routines), [data.routines])
  const [date, setDate] = useState(() => addCalendarDays(data.today, -1))
  const [draft, setDraft] = useState<DraftMap>({})
  const [baseline, setBaseline] = useState<DraftMap>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)
  const [valueEdit, setValueEdit] = useState<{ routineId: string; date: string } | null>(null)

  const month = monthKey(date)
  const monthChartDates = useMemo(() => {
    const bounds = monthBounds(month)
    return monthDates(bounds.start, bounds.end, data.today)
  }, [month, data.today])
  const summary = useMemo(
    () => monthStatusSummary(routines, monthChartDates, data),
    [routines, monthChartDates, data],
  )
  const targets = useMemo(() => dayRegisterTargets(data.routines, date), [data.routines, date])

  const targetKey = targets.map(routine => routine.id).join('|')

  const dirty = useMemo(() => !sameDraft(draft, baseline), [draft, baseline])

  useEffect(() => {
    const next = readDraft(targets, date, data)
    setDraft(next)
    setBaseline(next)
    setError('')
    setSavedNotice(false)
    // Só força reset ao trocar o dia ou a lista de hábitos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, targetKey])

  useEffect(() => {
    if (dirty || busy) return
    const next = readDraft(targets, date, data)
    setDraft(next)
    setBaseline(next)
  }, [data, dirty, busy, date, targets])

  const progress = useMemo(() => {
    const done = targets.reduce((count, routine) => {
      if (cellEditMode(routine.kind) === 'value') {
        return count + (routineReading(routine, date, data) != null ? 1 : 0)
      }
      return count + (draft[routine.id] != null ? 1 : 0)
    }, 0)
    return {
      total: targets.length,
      done,
      complete: targets.length > 0 && done === targets.length,
    }
  }, [targets, date, data, draft])

  const canGoNext = date < data.today
  const progressPct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  const changeDate = (next: string) => {
    if (dirty && !window.confirm('Há alterações não salvas. Descartar e trocar de dia?')) return
    setDate(next)
  }

  const pickStatus = (routineId: string, level: StatusLevel | null) => {
    if (busy) return
    setSavedNotice(false)
    setError('')
    setDraft(current => ({ ...current, [routineId]: level }))
  }

  const saveDay = useCallback(async () => {
    if (!dirty || busy) return
    setBusy(true)
    setError('')
    setSavedNotice(false)
    try {
      const statusTargets = targets.filter(routine => cellEditMode(routine.kind) !== 'value')
      await saveRoutineValues(
        date,
        statusTargets.map(routine => ({
          routineId: routine.id,
          value: statusToSaveValue(routine, draft[routine.id] ?? null),
        })),
      )
      setBaseline(draft)
      setSavedNotice(true)
      onSaved?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }, [busy, dirty, targets, date, draft, onSaved])

  if (!routines.length) {
    return (
      <section className="tracking-panel daily-grid-empty">
        <h2>Nenhum hábito ativo</h2>
        <p className="helper">Ative ou crie acompanhamentos para registrar o dia.</p>
        <Link className="btn-primary" to="/rotinas">Configurar rotinas</Link>
      </section>
    )
  }

  return (
    <div className="daily-grid">
      <section className="daily-grid-summary" aria-label="Resumo do mês">
        <SummaryCard tone="otimo" label="Ótimo" count={summary.otimo} share={percent(summary.otimo, summary.total)} face={5} />
        <SummaryCard tone="regular" label="Mediano" count={summary.regular} share={percent(summary.regular, summary.total)} face={3} />
        <SummaryCard tone="ruim" label="Ruim" count={summary.ruim} share={percent(summary.ruim, summary.total)} face={1} />
        <SummaryCard tone="total" label="Registros" count={summary.total} />
      </section>

      <section className={`tracking-panel daily-day-panel${dirty ? ' is-dirty' : ''}`}>
        <div className="daily-day-toolbar" role="group" aria-label="Dia do registro">
          <button
            type="button"
            className="btn-icon"
            aria-label="Dia anterior"
            onClick={() => changeDate(addCalendarDays(date, -1))}
          >
            <CaretLeft size={20} />
          </button>
          <div className="daily-day-heading">
            <strong>{dayHeading(date, data.today)}</strong>
            <span>{formatShortDate(date)}</span>
          </div>
          <button
            type="button"
            className="btn-icon"
            aria-label="Próximo dia"
            disabled={!canGoNext}
            onClick={() => canGoNext && changeDate(addCalendarDays(date, 1))}
          >
            <CaretRight size={20} />
          </button>
        </div>

        <div
          className="daily-day-progress"
          role="status"
          aria-label={`${progress.done} de ${progress.total} hábitos registrados`}
        >
          <div className="daily-day-progress-meta">
            <strong>{progress.done}/{progress.total}</strong>
            <span>
              {dirty
                ? 'Alterações não salvas'
                : progress.complete
                  ? 'Dia completo'
                  : 'Toque nas carinhas para registrar'}
            </span>
          </div>
          <div className="daily-day-progress-bar" aria-hidden="true">
            <span style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}
        {savedNotice && !dirty && (
          <p className="helper daily-day-saved" role="status">Registro salvo.</p>
        )}

        {!targets.length ? (
          <p className="helper">Nenhum hábito previsto para este dia.</p>
        ) : (
          <ul className="daily-day-list">
            {targets.map(routine => {
              const reading = routineReading(routine, date, data)
              const mode = cellEditMode(routine.kind)
              const level = mode === 'value'
                ? readingToStatus(routine, reading)
                : (draft[routine.id] ?? null)
              const done = mode === 'value' ? reading != null : level != null
              const changed = mode !== 'value' && (draft[routine.id] ?? null) !== (baseline[routine.id] ?? null)

              return (
                <li
                  key={routine.id}
                  className={`daily-day-item${done ? ' is-done' : ''}${changed ? ' is-changed' : ''}`}
                >
                  <div className="daily-day-item-top">
                    <div className="min-w-0">
                      <strong>{routine.name}</strong>
                      <span className="helper">
                        {mode === 'value'
                          ? readingLabel(routine, reading)
                          : (level ? statusLabel(level) : 'Sem registro')}
                        {changed ? ' · editado' : ''}
                      </span>
                    </div>
                    {done && (
                      <span className="daily-day-done" aria-hidden="true">
                        <Check size={14} weight="bold" />
                      </span>
                    )}
                  </div>

                  {mode === 'value' ? (
                    <button
                      type="button"
                      className="daily-day-value-btn"
                      onClick={() => setValueEdit({ routineId: routine.id, date })}
                    >
                      {reading ? `Editar · ${readingLabel(routine, reading)}` : 'Registrar valor'}
                    </button>
                  ) : mode === 'binary' ? (
                    <BinaryScale
                      routine={routine}
                      level={level}
                      disabled={busy}
                      onPick={next => pickStatus(routine.id, next)}
                    />
                  ) : (
                    <FaceScale
                      routine={routine}
                      level={level}
                      disabled={busy}
                      onPick={next => pickStatus(routine.id, next)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="daily-day-footer">
          <Link className="inline-link" to="/rotinas">Hábitos</Link>
          <button
            type="button"
            className="btn-primary daily-day-save"
            disabled={!dirty || busy}
            onClick={() => void saveDay()}
          >
            {busy ? 'Salvando…' : dirty ? 'Salvar alterações' : 'Salvo'}
          </button>
        </div>
      </section>

      {valueEdit && (
        <BottomSheet
          title={routines.find(item => item.id === valueEdit.routineId)?.name ?? 'Registrar'}
          description={formatDayLabel(valueEdit.date)}
          onClose={() => setValueEdit(null)}
        >
          <RoutineReviewForm
            key={`${valueEdit.routineId}:${valueEdit.date}`}
            data={data}
            date={valueEdit.date}
            routineId={valueEdit.routineId}
            onSaved={() => {
              setValueEdit(null)
              onSaved?.()
            }}
          />
        </BottomSheet>
      )}
    </div>
  )
}
