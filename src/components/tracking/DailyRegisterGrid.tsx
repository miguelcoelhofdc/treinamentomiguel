import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CaretLeft, CaretRight, Check, Minus, X } from '@phosphor-icons/react'
import type { TrackingData } from '@/hooks/useTracking'
import { saveRoutineValues } from '@/db/routines'
import {
  addCalendarMonths,
  formatDayLabel,
  formatMonthLabel,
  monthBounds,
  monthKey,
} from '@/lib/date'
import { routineSessions } from '@/lib/routines'
import {
  STATUS_SCALE,
  buildMonthGridMatrix,
  cellEditMode,
  cellMark,
  gridRoutines,
  habitShortLabel,
  monthDates,
  monthStatusSummary,
  percent,
  statusToSaveValue,
  statusTone,
  type GridCellData,
  type StatusLevel,
} from '@/lib/routineStatus'
import type { RoutineDefinition } from '@/types'
import BottomSheet from '@/components/ui/BottomSheet'
import RoutineReviewForm from './RoutineReviewForm'
import HabitStatusChart from './HabitStatusChart'

function StatusIcon({ level, size = 13 }: { level: StatusLevel | null; size?: number }) {
  if (!level) return <span aria-hidden="true">·</span>
  if (level >= 4) return <Check size={size} weight="bold" aria-hidden="true" />
  if (level === 3) return <Minus size={size} weight="bold" aria-hidden="true" />
  return <X size={size} weight="bold" aria-hidden="true" />
}

function SummaryCard({
  tone,
  label,
  count,
  share,
}: {
  tone: 'otimo' | 'regular' | 'ruim' | 'total'
  label: string
  count: number
  share?: number
}) {
  return (
    <article className={`daily-grid-summary-card is-${tone}`}>
      <span className="daily-grid-summary-mark" aria-hidden="true">
        {tone === 'otimo' ? <Check size={14} weight="bold" /> : tone === 'ruim' ? <X size={14} weight="bold" /> : tone === 'regular' ? <Minus size={14} weight="bold" /> : null}
      </span>
      <div>
        <strong>{label}</strong>
        <p>
          {share != null ? `${share}%` : 'Total'}
          <span> · {count}</span>
        </p>
      </div>
    </article>
  )
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

const GridCellButton = memo(function GridCellButton({
  routineName,
  dayLabel,
  cell,
  active,
  busy,
  onClick,
}: {
  routineName: string
  dayLabel: string
  cell: GridCellData
  active: boolean
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`daily-grid-cell is-${statusTone(cell.level)}${active ? ' is-open' : ''}${busy ? ' is-busy' : ''}`}
      aria-label={`${routineName}, ${dayLabel}: ${cell.label}`}
      aria-haspopup={cell.mode === 'value' ? 'dialog' : 'menu'}
      aria-expanded={active}
      disabled={busy}
      onClick={onClick}
    >
      {cell.display != null ? (
        <span className="daily-grid-value">{cell.display}</span>
      ) : (
        <StatusIcon level={cell.level} />
      )}
      <span className="sr-only">{cellMark(cell.level)}</span>
    </button>
  )
})

export default function DailyRegisterGrid({
  data,
  onSaved,
}: {
  data: TrackingData
  onSaved?: () => void
}) {
  const routines = useMemo(() => gridRoutines(data.routines), [data.routines])
  const habitMeta = useMemo(
    () => routines.map(routine => ({ id: routine.id, name: routine.name, short: habitShortLabel(routine.name, 7) })),
    [routines],
  )
  const [month, setMonth] = useState(() => monthKey(data.today))
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState<{ routineId: string; date: string } | null>(null)
  const [valueEdit, setValueEdit] = useState<{ routineId: string; date: string } | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)

  const bounds = useMemo(() => monthBounds(month), [month])
  const dates = useMemo(
    () => monthDates(bounds.start, bounds.end, data.today).reverse(),
    [bounds, data.today],
  )
  const dayLabels = useMemo(
    () => Object.fromEntries(dates.map(date => [date, formatDayLabel(date)])),
    [dates],
  )
  const matrix = useMemo(
    () => buildMonthGridMatrix(routines, dates, data),
    [routines, dates, data],
  )
  const summary = useMemo(
    () => monthStatusSummary(routines, dates, data),
    [routines, dates, data],
  )

  const currentMonth = monthKey(data.today)
  const canGoNext = month < currentMonth
  const pickerRoutine = picker ? routines.find(item => item.id === picker.routineId) : undefined
  const pickerLevel = picker ? matrix.get(`${picker.routineId}:${picker.date}`)?.level ?? null : null
  const pickerLocked = Boolean(
    picker
    && pickerRoutine?.kind === 'exercise'
    && routineSessions(pickerRoutine, data, picker.date, picker.date).some(item => item.id !== `routine:${pickerRoutine.id}:${picker.date}`),
  )

  useEffect(() => {
    if (!picker) return
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPicker(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPicker(null)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [picker])

  const saveStatus = useCallback(async (routine: RoutineDefinition, date: string, level: StatusLevel | null) => {
    if (cellEditMode(routine.kind) === 'value' || busyRef.current) return
    const key = `${routine.id}:${date}`
    busyRef.current = true
    setBusyKey(key)
    setError('')
    try {
      await saveRoutineValues(date, [{ routineId: routine.id, value: statusToSaveValue(routine, level) }])
      setPicker(null)
      onSaved?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.')
    } finally {
      busyRef.current = false
      setBusyKey(null)
    }
  }, [onSaved])

  const openCell = useCallback((routineId: string, date: string, mode: GridCellData['mode']) => {
    setError('')
    if (mode === 'value') {
      setPicker(null)
      setValueEdit({ routineId, date })
      return
    }
    setValueEdit(null)
    setPicker(current => current?.routineId === routineId && current.date === date ? null : { routineId, date })
  }, [])

  if (!routines.length) {
    return (
      <section className="tracking-panel daily-grid-empty">
        <h2>Nenhum hábito ativo</h2>
        <p className="helper">Ative ou crie acompanhamentos para registrar o mês em grade.</p>
        <Link className="btn-primary" to="/rotinas">Configurar rotinas</Link>
      </section>
    )
  }

  return (
    <div className="daily-grid">
      <section className="tracking-panel daily-grid-toolbar">
        <div className="daily-grid-month" role="group" aria-label="Mês do registro">
          <button type="button" className="btn-icon" aria-label="Mês anterior" onClick={() => setMonth(current => addCalendarMonths(current, -1))}>
            <CaretLeft size={20} />
          </button>
          <strong>{formatMonthLabel(month)}</strong>
          <button type="button" className="btn-icon" aria-label="Próximo mês" disabled={!canGoNext} onClick={() => canGoNext && setMonth(current => addCalendarMonths(current, 1))}>
            <CaretRight size={20} />
          </button>
        </div>
        <p className="helper">Toque numa célula para marcar. Escala 5 · resumo em 3 faixas.</p>
      </section>

      <section className="daily-grid-summary" aria-label="Resumo do mês">
        <SummaryCard tone="otimo" label="Ótimo" count={summary.otimo} share={percent(summary.otimo, summary.total)} />
        <SummaryCard tone="regular" label="Regular" count={summary.regular} share={percent(summary.regular, summary.total)} />
        <SummaryCard tone="ruim" label="Ruim" count={summary.ruim} share={percent(summary.ruim, summary.total)} />
        <SummaryCard tone="total" label="Registros" count={summary.total} />
      </section>

      {error && <p className="field-error" role="alert">{error}</p>}

      <section className="tracking-panel daily-grid-panel">
        <div className="section-heading">
          <div>
            <h2>Registro do mês</h2>
            <p className="helper">Dias × hábitos · edição rápida</p>
          </div>
          <Link className="inline-link" to="/rotinas">Hábitos</Link>
        </div>
        <div className="daily-grid-scroll">
          <table className="daily-grid-table">
            <thead>
              <tr>
                <th scope="col" className="daily-grid-day-col">Dia</th>
                {habitMeta.map(habit => (
                  <th key={habit.id} scope="col" title={habit.name}>
                    <span className="daily-grid-habit-name">{habit.short}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map(date => (
                <tr key={date} className={date === data.today ? 'is-today' : undefined}>
                  <th scope="row">{dayLabels[date]}</th>
                  {routines.map(routine => {
                    const key = `${routine.id}:${date}`
                    const cell = matrix.get(key) ?? { level: null, mode: 'status' as const, label: 'Sem registro', display: null }
                    const active = picker?.routineId === routine.id && picker.date === date
                    return (
                      <td key={routine.id}>
                        <GridCellButton
                          routineName={routine.name}
                          dayLabel={dayLabels[date]}
                          cell={cell}
                          active={active}
                          busy={busyKey === key}
                          onClick={() => openCell(routine.id, date, cell.mode)}
                        />
                        {active && pickerRoutine && (
                          <div className="daily-grid-popover" ref={pickerRef}>
                            <StatusPicker
                              routine={pickerRoutine}
                              level={pickerLevel}
                              locked={pickerLocked}
                              onPick={next => void saveStatus(pickerRoutine, date, next)}
                              onClose={() => setPicker(null)}
                            />
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!dates.length && <p className="helper mt-4">Este mês ainda não começou.</p>}
      </section>

      <HabitStatusChart
        data={data}
        dates={dates}
        title="Por hábito"
        description="Proporção ótimo / regular / ruim no mês"
      />

      {valueEdit && (
        <BottomSheet
          title={routines.find(item => item.id === valueEdit.routineId)?.name ?? 'Registrar'}
          description={dayLabels[valueEdit.date] ?? formatDayLabel(valueEdit.date)}
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
