import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Check,
  CheckCircle,
  ClipboardText,
  Smiley,
  SmileyMeh,
  SmileySad,
  SmileyWink,
  SmileyXEyes,
} from '@phosphor-icons/react'
import type { TrackingData } from '@/hooks/useTracking'
import { saveRoutineValues } from '@/db/routines'
import { addCalendarDays, formatShortDate } from '@/lib/date'
import { getStoredProfileId } from '@/lib/auth'
import { habitIcon } from '@/lib/habitIcons'
import { routineReading } from '@/lib/routines'
import {
  STATUS_SCALE,
  homeCheckInMode,
  homeCheckInProgress,
  homeCheckInTargets,
  pendingHomeCheckInDates,
  readingToStatus,
  statusToSaveValue,
  type StatusLevel,
} from '@/lib/routineStatus'
import type { RoutineDefinition } from '@/types'

const FACE_ICONS = [SmileyXEyes, SmileySad, SmileyMeh, Smiley, SmileyWink] as const
const FACES = STATUS_SCALE.map((item, index) => ({ level: item.level, label: item.label, Icon: FACE_ICONS[index] }))
const BINARY = [{ level: 1, label: 'Não fiz', Icon: SmileySad }, { level: 5, label: 'Feito', Icon: Smiley }] as const

type DraftMap = Record<string, StatusLevel | null>
type Phase = 'edit' | 'success' | 'leaving'
type Outcome = { date: string; mode: 'saved' | 'skipped'; remaining: number }

function skippedStorageKey(today: string) {
  return `home-checkin-skipped:${getStoredProfileId() ?? 'miguel'}:${today}`
}

export function loadSkippedCheckIns(today: string): string[] {
  try {
    const raw = sessionStorage.getItem(skippedStorageKey(today))
    const parsed = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function persistSkipped(today: string, dates: string[]) {
  try {
    sessionStorage.setItem(skippedStorageKey(today), JSON.stringify(dates))
  } catch { /* The current page still keeps the skipped dates. */ }
}

function readDraft(targets: RoutineDefinition[], date: string, data: TrackingData): DraftMap {
  return Object.fromEntries(
    targets.map(routine => [routine.id, readingToStatus(routine, routineReading(routine, date, data))]),
  )
}

/** Ex.: "Ontem - Quarta-Feira (20)" ou "Pendente - Segunda-Feira (16)". */
function checkInTitle(dateKey: string, yesterday: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
    .format(new Date(year, month - 1, day))
  const weekdayLabel = weekday
    .split('-')
    .map(part => part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1))
    .join('-')
  const prefix = dateKey === yesterday ? 'Ontem' : 'Pendente'
  return `${prefix} - ${weekdayLabel} (${day})`
}

export default function HomeYesterdayRegister({
  data,
  onSettlingChange,
  onSkippedChange,
}: {
  data: TrackingData
  onSettlingChange?: (settling: boolean) => void
  onSkippedChange?: (dates: string[]) => void
}) {
  const yesterday = addCalendarDays(data.today, -1)
  const [skipped, setSkipped] = useState(() => loadSkippedCheckIns(data.today))
  const [resolved, setResolved] = useState<string[]>([])
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('edit')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [edits, setEdits] = useState<{ date: string; values: DraftMap } | null>(null)
  const checkInRef = useRef<HTMLElement>(null)
  const leaveTimer = useRef<number | null>(null)
  const submitting = useRef(false)

  const pending = useMemo(
    () => pendingHomeCheckInDates(data.routines, data.today, data, [...skipped, ...resolved]),
    [data, skipped, resolved],
  )

  const date = pending[0] ?? null
  const targets = useMemo(
    () => (date ? homeCheckInTargets(data.routines, date) : []),
    [data.routines, date],
  )
  const changed = edits?.date === date ? edits?.values : undefined
  const draft = date ? { ...readDraft(targets, date, data), ...changed } : {}

  useEffect(() => {
    setConfirmSkip(false)
    setError('')
  }, [date])

  useEffect(() => {
    if (!resolved.length || !resolved.some(day => homeCheckInProgress(data.routines, day, data).complete)) return
    setResolved(current => current.filter(day => !homeCheckInProgress(data.routines, day, data).complete))
  }, [data, resolved])

  useEffect(() => () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
  }, [])

  useEffect(() => {
    if (phase === 'success') checkInRef.current?.scrollIntoView({ block: 'nearest' })
  }, [phase])

  const rated = targets.filter(routine => draft[routine.id] != null).length
  const canSave = Boolean(date) && targets.length > 0 && rated === targets.length && !busy && phase === 'edit'

  const finishCurrent = (mode: 'saved' | 'skipped') => {
    if (!date) return
    const nextResolved = mode === 'saved' ? [...resolved, date] : resolved
    const nextSkipped = mode === 'skipped' ? [...skipped, date] : skipped
    setOutcome({ date, mode, remaining: Math.max(0, pending.length - 1) })
    if (mode === 'saved') setResolved(nextResolved)
    if (mode === 'skipped') {
      setSkipped(nextSkipped)
      persistSkipped(data.today, nextSkipped)
      onSkippedChange?.(nextSkipped)
    }
    setPhase('success')
    setEdits(null)
    leaveTimer.current = window.setTimeout(() => {
      setPhase('leaving')
      leaveTimer.current = window.setTimeout(() => {
        setOutcome(null)
        setBusy(false)
        setPhase('edit')
        submitting.current = false
        onSettlingChange?.(false)
      }, 380)
    }, 900)
  }

  const pickStatus = (routine: RoutineDefinition, level: StatusLevel) => {
    if (busy || phase !== 'edit') return
    if (!date) return
    setEdits({
      date,
      values: { ...changed, [routine.id]: draft[routine.id] === level ? null : level },
    })
    setError('')
  }

  const saveAndFinish = async () => {
    if (!canSave || !date || submitting.current) return
    submitting.current = true
    onSettlingChange?.(true)
    setBusy(true)
    setError('')
    try {
      await saveRoutineValues(
        date,
        targets.filter(routine => changed && Object.hasOwn(changed, routine.id)).map(routine => ({
          routineId: routine.id,
          value: statusToSaveValue(routine, draft[routine.id] ?? null),
        })),
      )
      finishCurrent('saved')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.')
      setBusy(false)
      submitting.current = false
      onSettlingChange?.(false)
    }
  }

  const skipCurrent = () => {
    if (!date || busy || phase !== 'edit') return
    if (!confirmSkip) {
      setConfirmSkip(true)
      return
    }
    setConfirmSkip(false)
    onSettlingChange?.(true)
    finishCurrent('skipped')
  }

  if (!date && phase === 'edit') return null

  const showDate = outcome?.date ?? date
  if (!showDate) return null

  const title = checkInTitle(showDate, yesterday)

  return (
    <section
      ref={checkInRef}
      id="check-in"
      data-checkin-date={showDate}
      tabIndex={-1}
      className={`dashboard-card home-checkin is-${phase}${showDate === yesterday ? '' : ' is-overdue'}`}
      aria-labelledby="home-checkin-title"
      aria-busy={busy || phase !== 'edit'}
    >
      {phase === 'success' || phase === 'leaving' ? (
        <div className="home-checkin-success" role="status" aria-live="polite">
          <span className="home-checkin-success-icon" aria-hidden="true">
            <CheckCircle size={42} weight="fill" />
          </span>
          <h2 id="home-checkin-title">{outcome?.mode === 'skipped' ? 'Dia pulado' : 'Check-in registrado'}</h2>
          <p>
            {outcome?.mode === 'skipped'
              ? `${formatShortDate(showDate)} foi pulado.`
              : showDate === yesterday
                ? 'Seus hábitos de ontem foram salvos.'
                : `Check-in de ${formatShortDate(showDate)} concluído.`}
            {outcome && outcome.remaining > 0
              ? ` · ${outcome.remaining} ${outcome.remaining === 1 ? 'pendente' : 'pendentes'} na fila`
              : ''}
          </p>
        </div>
      ) : (
        <>
          <header className="dashboard-section-header">
            <div className="dashboard-section-heading">
              <span className="dashboard-icon" aria-hidden="true"><ClipboardText size={21} /></span>
              <div>
                <h2 id="home-checkin-title">{title}</h2>
                <p>
                  {formatShortDate(showDate)}
                  {pending.length > 1 ? ` · 1 de ${pending.length}` : ''}
                  {' · Escolha uma carinha'}
                </p>
              </div>
            </div>
            {targets.length > 0 && (
              <span className={`home-checkin-count${rated === targets.length ? ' is-complete' : ''}`} role="status" aria-live="polite">
                {rated === targets.length && <Check size={15} weight="bold" aria-hidden="true" />}
                {rated === targets.length ? 'Completo' : `${rated}/${targets.length}`}
              </span>
            )}
          </header>

          {error && <p className="field-error" role="alert">{error}</p>}

          {targets.length ? (
            <ul className="home-checkin-list">
              {targets.map(routine => {
                const level = draft[routine.id] ?? null
                const binary = homeCheckInMode(routine.kind) === 'binary'
                const Icon = habitIcon(routine.kind, routine.name)
                return (
                  <li key={routine.id} className="home-checkin-item">
                    <div className="home-checkin-name">
                      <Icon size={20} aria-hidden="true" />
                      <h3>{routine.name}</h3>
                    </div>
                    <div className={`dashboard-faces${binary ? ' is-binary' : ''}`} role="group" aria-label={routine.name}>
                      {(binary ? BINARY : FACES).map(({ level: option, label, Icon: Face }) => (
                        <button
                          key={option}
                          type="button"
                          className={`dashboard-face is-level-${option}`}
                          aria-pressed={level === option}
                          disabled={busy}
                          onClick={() => pickStatus(routine, option)}
                        >
                          <Face size={21} weight={level === option ? 'fill' : 'regular'} aria-hidden="true" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : <p className="home-empty">Nenhum hábito previsto neste dia.</p>}

          <div className="home-checkin-footer">
            {confirmSkip ? (
              <div className="home-checkin-skip-confirm" role="group" aria-label="Confirmar pular dia">
                <p>Pular {formatShortDate(showDate)}? Você pode registrar depois em Registrar.</p>
                <div className="home-checkin-skip-actions">
                  <button type="button" className="home-text-link" onClick={() => setConfirmSkip(false)}>
                    Voltar
                  </button>
                  <button type="button" className="home-action home-checkin-skip is-confirm" onClick={skipCurrent}>
                    Sim, pular
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="home-checkin-footer-links">
                  <button type="button" className="home-text-link" onClick={skipCurrent} disabled={busy}>
                    Pular este dia
                  </button>
                  <Link className="home-text-link home-checkin-link" to={targets.length ? '/registrar?modo=dia' : '/rotinas'}>
                    {targets.length ? 'Registrar outro dia' : 'Configurar hábitos'} <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
                {targets.length > 0 && (
                  <button
                    type="button"
                    className="home-action home-checkin-save"
                    disabled={!canSave}
                    onClick={() => void saveAndFinish()}
                  >
                    {busy ? 'Salvando…' : 'Registrar e salvar'}
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
