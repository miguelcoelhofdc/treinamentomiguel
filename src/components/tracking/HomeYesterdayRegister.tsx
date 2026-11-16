import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Minus, X } from '@phosphor-icons/react'
import type { TrackingData } from '@/hooks/useTracking'
import { saveRoutineValues } from '@/db/routines'
import { addCalendarDays, formatShortDate } from '@/lib/date'
import { readingLabel, routineReading, routineSessions } from '@/lib/routines'
import { numberLabel } from '@/lib/tracking'
import {
  STATUS_SCALE,
  cellEditMode,
  dayRegisterProgress,
  dayRegisterTargets,
  gridRoutines,
  readingToStatus,
  statusLabel,
  statusToSaveValue,
  statusTone,
  type StatusLevel,
} from '@/lib/routineStatus'
import type { RoutineDefinition } from '@/types'
import BottomSheet from '@/components/ui/BottomSheet'
import RoutineReviewForm from './RoutineReviewForm'
import HomeHabitsInsight from './HomeHabitsInsight'

function StatusIcon({ level, size = 16 }: { level: StatusLevel | null; size?: number }) {
  if (!level) return <span aria-hidden="true">·</span>
  if (level >= 4) return <Check size={size} weight="bold" aria-hidden="true" />
  if (level === 3) return <Minus size={size} weight="bold" aria-hidden="true" />
  return <X size={size} weight="bold" aria-hidden="true" />
}

function StatusPicker({
  routine,
  level,
  locked,
  onPick,
  onClose,
}: {
  routine: RoutineDefinition
  level: StatusLevel | null
  locked?: boolean
  onPick: (next: StatusLevel | null) => void
  onClose: () => void
}) {
  const mode = cellEditMode(routine.kind)
  if (mode === 'value') return null
  const options = mode === 'binary'
    ? [
        { level: 5 as StatusLevel, label: 'Feito' },
        { level: 1 as StatusLevel, label: 'Não fiz' },
      ]
    : STATUS_SCALE.map(item => ({ level: item.level, label: item.short }))
  return (
    <div className="daily-grid-picker" role="dialog" aria-label={`Status de ${routine.name}`}>
      <p className="helper">{routine.name}</p>
      {locked && <p className="helper">Treino já registrado no histórico — edite por lá.</p>}
      <div className="daily-grid-picker-options" role="group">
        {options.map(option => (
          <button
            key={option.level}
            type="button"
            className={`daily-grid-cell is-${statusTone(option.level)}${level === option.level ? ' is-selected' : ''}`}
            disabled={locked}
            aria-pressed={level === option.level}
            onClick={() => onPick(option.level)}
          >
            <StatusIcon level={option.level} />
            <span>{option.label}</span>
          </button>
        ))}
        <button type="button" className="daily-grid-cell is-empty" disabled={locked} onClick={() => onPick(null)}>
          <span>·</span>
          <span>Limpar</span>
        </button>
      </div>
      <button type="button" className="inline-link" onClick={onClose}>Fechar</button>
    </div>
  )
}

export default function HomeYesterdayRegister({
  data,
  onSaved,
}: {
  data: TrackingData
  onSaved?: () => void
}) {
  const yesterday = addCalendarDays(data.today, -1)
  const enabledHabits = useMemo(() => gridRoutines(data.routines), [data.routines])
  const targets = useMemo(() => dayRegisterTargets(data.routines, yesterday), [data.routines, yesterday])
  const progress = useMemo(
    () => dayRegisterProgress(data.routines, yesterday, data),
    [data, yesterday],
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [valueEdit, setValueEdit] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const openRoutine = openId ? targets.find(item => item.id === openId) : undefined
  const openLevel = openRoutine
    ? readingToStatus(openRoutine, routineReading(openRoutine, yesterday, data))
    : null
  const openLocked = Boolean(
    openRoutine?.kind === 'exercise'
    && routineSessions(openRoutine, data, yesterday, yesterday).some(item => item.id !== `routine:${openRoutine.id}:${yesterday}`),
  )

  useEffect(() => {
    if (!openId) return
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpenId(null)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [openId])

  const saveStatus = async (routine: RoutineDefinition, level: StatusLevel | null) => {
    if (cellEditMode(routine.kind) === 'value' || busyId) return
    setBusyId(routine.id)
    setError('')
    try {
      await saveRoutineValues(yesterday, [{ routineId: routine.id, value: statusToSaveValue(routine, level) }])
      setOpenId(null)
      onSaved?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.')
    } finally {
      setBusyId(null)
    }
  }

  const openCell = (routine: RoutineDefinition) => {
    setError('')
    if (cellEditMode(routine.kind) === 'value') {
      setOpenId(null)
      setValueEdit(routine.id)
      return
    }
    setValueEdit(null)
    setOpenId(current => current === routine.id ? null : routine.id)
  }

  if (!enabledHabits.length) {
    return (
      <section className="tracking-panel home-yesterday-empty" aria-labelledby="home-yesterday-empty-title">
        <p className="page-kicker">Rotina</p>
        <h2 id="home-yesterday-empty-title">Registrar ontem</h2>
        <p className="helper">Nenhum hábito ativo ainda. Ative Água, Sono, Alimentação ou crie os seus para marcar o dia aqui.</p>
        <div className="home-yesterday-empty-actions">
          <Link className="btn-primary" to="/rotinas">Configurar rotinas</Link>
          <Link className="inline-link" to="/registrar?modo=dia">Abrir grade do mês</Link>
        </div>
      </section>
    )
  }

  if (!targets.length) {
    return (
      <section className="tracking-panel home-yesterday-empty" aria-labelledby="home-yesterday-empty-title">
        <p className="page-kicker">Rotina</p>
        <h2 id="home-yesterday-empty-title">Nada agendado para ontem</h2>
        <p className="helper">
          Você tem {enabledHabits.length} {enabledHabits.length === 1 ? 'hábito ativo' : 'hábitos ativos'}, mas nenhum cai em {formatShortDate(yesterday)} pela frequência escolhida.
        </p>
        <div className="home-yesterday-empty-actions">
          <Link className="btn-secondary" to="/rotinas">Ajustar frequência</Link>
          <Link className="inline-link" to="/registrar?modo=dia">Ver grade do mês</Link>
        </div>
      </section>
    )
  }

  if (progress.complete) {
    return <HomeHabitsInsight data={data} yesterday={yesterday} />
  }

  return (
    <section className="tracking-panel home-yesterday-register" aria-labelledby="home-yesterday-title">
      <div className="section-heading">
        <div>
          <p className="page-kicker">Rotina</p>
          <h2 id="home-yesterday-title">Registrar ontem</h2>
          <p className="helper">
            {formatShortDate(yesterday)} · {progress.done} de {progress.total} hábitos
          </p>
        </div>
        <Link className="inline-link" to="/registrar?modo=dia">Grade do mês</Link>
      </div>

      {error && <p className="field-error" role="alert">{error}</p>}

      <ul className="home-yesterday-list">
        {targets.map(routine => {
          const reading = routineReading(routine, yesterday, data)
          const level = readingToStatus(routine, reading)
          const mode = cellEditMode(routine.kind)
          const label = mode === 'value' && reading
            ? readingLabel(routine, reading)
            : statusLabel(level)
          const open = openId === routine.id
          return (
            <li key={routine.id} className="home-yesterday-row">
              <div className="home-yesterday-copy">
                <strong>{routine.name}</strong>
                <span className="helper">{label}</span>
              </div>
              <div className="home-yesterday-action">
                <button
                  type="button"
                  className={`daily-grid-cell is-${statusTone(level)}${open ? ' is-open' : ''}${busyId === routine.id ? ' is-busy' : ''}`}
                  aria-label={`${routine.name}: ${label}`}
                  aria-haspopup={mode === 'value' ? 'dialog' : 'menu'}
                  aria-expanded={open}
                  disabled={busyId === routine.id}
                  onClick={() => openCell(routine)}
                >
                  {mode === 'value' && reading ? (
                    <span className="daily-grid-value">
                      {numberLabel(routine.kind === 'water' ? (reading.volumeMl ?? 0) / 1000 : reading.value)}
                    </span>
                  ) : (
                    <StatusIcon level={level} />
                  )}
                </button>
                {open && openRoutine && (
                  <div className="daily-grid-popover home-yesterday-popover" ref={pickerRef}>
                    <StatusPicker
                      routine={openRoutine}
                      level={openLevel}
                      locked={openLocked}
                      onPick={next => void saveStatus(openRoutine, next)}
                      onClose={() => setOpenId(null)}
                    />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="helper home-yesterday-hint">Toque na bolinha colorida para marcar cada hábito.</p>

      {valueEdit && (
        <BottomSheet
          title={targets.find(item => item.id === valueEdit)?.name ?? 'Registrar'}
          description={formatShortDate(yesterday)}
          onClose={() => setValueEdit(null)}
        >
          <RoutineReviewForm
            key={`${valueEdit}:${yesterday}`}
            data={data}
            date={yesterday}
            routineId={valueEdit}
            onSaved={() => {
              setValueEdit(null)
              onSaved?.()
            }}
          />
        </BottomSheet>
      )}
    </section>
  )
}
