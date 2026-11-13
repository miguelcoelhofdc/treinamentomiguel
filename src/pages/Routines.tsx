import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight, Plus } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import { SavedNotice, TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'
import RoutineGoalStatus from '@/components/tracking/RoutineGoalStatus'
import { useTracking, type TrackingData } from '@/hooks/useTracking'
import { endRoutineGoal, saveRoutine, saveRoutineGoal } from '@/db/routines'
import { FIVE_RATINGS, goalMetrics, KIND_LABELS, scheduleOn } from '@/lib/routines'
import { decimal } from '@/lib/tracking'
import type { RoutineDefinition, RoutineGoal, RoutineGoalMetric, RoutineKind, RoutineSchedule } from '@/types'

const METRICS: Record<RoutineGoalMetric, string> = { value: 'Valor por dia', days: 'Dias atingindo um mínimo', sessions: 'Quantidade de sessões', minutes: 'Tempo em minutos', distance: 'Distância em km', runTime: 'Correr uma distância em um tempo' }
const DAYS = [{ day: 1, label: 'Seg' }, { day: 2, label: 'Ter' }, { day: 3, label: 'Qua' }, { day: 4, label: 'Qui' }, { day: 5, label: 'Sex' }, { day: 6, label: 'Sáb' }, { day: 0, label: 'Dom' }]
const ROUTINE_GROUPS = [
  { name: 'Exercícios', kinds: ['exercise'] },
  { name: 'Alimentação e hidratação', kinds: ['nutrition', 'water'] },
  { name: 'Sono e corpo', kinds: ['sleep', 'weight'] },
  { name: 'Cuidados e hábitos', kinds: ['check', 'count', 'duration', 'rating'] },
]

function RoutineEditor({ routine, data, onSaved }: { routine?: RoutineDefinition; data: TrackingData; onSaved: () => void }) {
  const [name, setName] = useState(routine?.name ?? '')
  const [kind, setKind] = useState<RoutineKind>(routine?.kind ?? 'check')
  const [schedule, setSchedule] = useState<RoutineSchedule>(() => routine ? [...(routine.scheduleChanges ?? [])].sort((a, b) => b.from.localeCompare(a.from))[0]?.schedule ?? scheduleOn(routine, data.today) : { mode: 'daily', weekdays: [] })
  const [bottle, setBottle] = useState(String((routine?.bottleMl ?? 1700) / 1000).replace('.', ','))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await saveRoutine({ ...routine, id: routine?.id ?? `habit:${crypto.randomUUID()}`, name: name.trim(), kind, enabled: routine?.enabled ?? true, createdDate: routine?.createdDate ?? data.today, schedule, ...(kind === 'water' ? { bottleMl: (decimal(bottle) ?? NaN) * 1000 } : {}) })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); setBusy(false) }
  }
  return <form className="tracking-form" onSubmit={event => void submit(event)} noValidate><fieldset className="tracking-fields" disabled={busy}><label className="label">Nome<input className="input mt-2" maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>{!routine && <label className="label">Modelo de registro<select className="input mt-2" value={kind} onChange={event => setKind(event.target.value as RoutineKind)}>{(['check', 'count', 'duration', 'rating'] as const).map(value => <option key={value} value={value}>{KIND_LABELS[value]}</option>)}</select></label>}{kind === 'water' && <label className="label">Tamanho da garrafa · litros<input className="input mt-2" inputMode="decimal" value={bottle} onChange={event => setBottle(event.target.value)} /><span className="helper block mt-2">Ex.: 1,7. Registros anteriores mantêm o volume original.</span></label>}<label className="label">Frequência<select className="input mt-2" value={schedule.mode} onChange={event => setSchedule({ ...schedule, mode: event.target.value as RoutineSchedule['mode'], weekdays: schedule.weekdays.length ? schedule.weekdays : [1, 3, 5], timesPerWeek: schedule.timesPerWeek ?? 3 })}><option value="daily">Todos os dias</option><option value="weekdays">Dias escolhidos</option><option value="weekly">Quantidade livre na semana</option><option value="any">Quando eu quiser</option></select></label>{schedule.mode === 'weekdays' && <div className="routine-weekdays" role="group" aria-label="Dias da rotina">{DAYS.map(({ day, label }) => <button type="button" className="btn-secondary" key={day} aria-pressed={schedule.weekdays.includes(day)} onClick={() => setSchedule({ ...schedule, weekdays: schedule.weekdays.includes(day) ? schedule.weekdays.filter(value => value !== day) : [...schedule.weekdays, day] })}>{label}</button>)}</div>}{schedule.mode === 'weekly' && <label className="label">Em quantos dias da semana?<input className="input mt-2" type="number" min={1} max={7} value={schedule.timesPerWeek ?? 3} onChange={event => setSchedule({ ...schedule, timesPerWeek: Number(event.target.value) })} /></label>}{routine && <p className="helper">Mudanças de frequência começam amanhã, ou na próxima segunda para frequências semanais e dias escolhidos.</p>}</fieldset>{error && <p role="alert" className="field-error">{error}</p>}<button className="btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar acompanhamento'}</button></form>
}

function GoalEditor({ routine, data, goal, onSaved }: { routine: RoutineDefinition; data: TrackingData; goal?: RoutineGoal; onSaved: () => void }) {
  const [metric, setMetric] = useState<RoutineGoalMetric>(goal?.metric ?? goalMetrics(routine)[0])
  const [target, setTarget] = useState(String(goal?.changes?.at(-1)?.target ?? goal?.target ?? ''))
  const [threshold, setThreshold] = useState(String(goal?.threshold ?? (['nutrition', 'rating'].includes(routine.kind) ? 4 : 1)))
  const [period, setPeriod] = useState<RoutineGoal['period']>(goal?.period ?? (routine.kind === 'weight' ? 'target' : routine.kind === 'exercise' ? 'week' : 'day'))
  const [endDate, setEndDate] = useState(goal?.endDate ?? '')
  const [distance, setDistance] = useState(String(goal?.distanceKm ?? 5))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(''); setBusy(true)
    const baseline = [...data.daily].filter(log => log.weightKg != null && log.date <= data.today).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg
    try {
      await saveRoutineGoal({ ...goal, id: goal?.id ?? crypto.randomUUID(), routineId: routine.id, title: goal?.title ?? `${routine.name} · ${metric === 'days' ? 'dias com meta atingida' : routine.kind === 'weight' ? 'peso desejado' : METRICS[metric].toLocaleLowerCase('pt-BR')}`, metric, period, target: decimal(target) ?? NaN, startDate: goal?.startDate ?? data.today, endDate: endDate || undefined, threshold: metric === 'days' ? decimal(threshold) : undefined, baseline: routine.kind === 'weight' ? baseline : undefined, distanceKm: metric === 'runTime' ? decimal(distance) : undefined })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a meta.'); setBusy(false) }
  }
  const unit = metric === 'days' ? 'dias por semana' : metric === 'minutes' || metric === 'runTime' ? 'minutos' : metric === 'distance' ? 'km' : metric === 'sessions' ? 'sessões' : routine.kind === 'water' ? 'garrafas por dia' : routine.kind === 'sleep' ? 'horas por noite' : routine.kind === 'weight' ? 'kg desejados' : routine.kind === 'duration' ? 'minutos por dia' : ['nutrition', 'rating'].includes(routine.kind) ? 'nota mínima · 1 a 5' : 'vezes por dia'
  return <form className="tracking-form" onSubmit={event => void submit(event)} noValidate><fieldset className="tracking-fields" disabled={busy}>{!goal && <label className="label">O que acompanhar<select className="input mt-2" value={metric} onChange={event => { const next = event.target.value as RoutineGoalMetric; setMetric(next); setPeriod(next === 'days' ? 'week' : next === 'runTime' || routine.kind === 'weight' ? 'target' : routine.kind === 'exercise' ? 'week' : 'day') }}>{goalMetrics(routine).map(value => <option key={value} value={value}>{routine.kind === 'weight' ? 'Peso desejado' : METRICS[value]}</option>)}</select></label>}<label className="label">Meta · {unit}<input className="input mt-2" inputMode="decimal" value={target} onChange={event => setTarget(event.target.value)} /></label>{metric === 'days' && !goal && <label className="label">Mínimo em cada dia {routine.kind === 'water' ? '· garrafas' : ['nutrition', 'rating'].includes(routine.kind) ? '· nota de 1 a 5' : routine.kind === 'sleep' ? '· horas' : routine.kind === 'duration' ? '· minutos' : '· vezes'}<input className="input mt-2" inputMode="decimal" value={threshold} onChange={event => setThreshold(event.target.value)} />{['nutrition', 'rating'].includes(routine.kind) && <span className="helper">4 corresponde a {FIVE_RATINGS[3]}.</span>}</label>}{routine.kind === 'exercise' && !['days', 'runTime'].includes(metric) && !goal && <label className="label">Período<select className="input mt-2" value={period} onChange={event => setPeriod(event.target.value as RoutineGoal['period'])}><option value="week">Por semana</option><option value="day">Por dia</option><option value="target">Objetivo acumulado</option></select></label>}{metric === 'runTime' && !goal && <label className="label">Distância a completar · km<input className="input mt-2" inputMode="decimal" value={distance} onChange={event => setDistance(event.target.value)} /></label>}{period === 'target' && !goal && <label className="label">Prazo · opcional<input className="input mt-2" type="date" min={data.today} value={endDate} onChange={event => setEndDate(event.target.value)} /></label>}{goal && <p className="helper">A nova quantidade passa a valer no próximo período. Os resultados anteriores ficam preservados.</p>}{routine.kind === 'weight' && baselineMissing(data) && <p className="helper">Registre seu peso para estabelecer a referência de evolução.</p>}</fieldset>{error && <p className="field-error" role="alert">{error}</p>}<button className="btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar meta'}</button></form>
}
function baselineMissing(data: TrackingData) { return !data.daily.some(log => log.weightKg != null) }

export default function Routines() {
  const data = useTracking()
  const [editing, setEditing] = useState<RoutineDefinition | 'new' | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [goalEditor, setGoalEditor] = useState<RoutineGoal | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const routine = data.routines.find(item => item.id === selected)
  const action = async (fn: () => Promise<void>, message: string) => {
    if (busy) return
    setBusy(true); setError('')
    try { await fn(); setNotice(message) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.') } finally { setBusy(false) }
  }
  return <main className="page-content page-enter"><PageHeader title="Rotinas e metas" description="Escolha o que faz sentido acompanhar." action={<button className="btn-primary" onClick={() => setEditing('new')}><Plus size={19} />Hábito</button>} /><div className="flex flex-wrap gap-3 mb-5"><Link className="inline-link" to="/">Início</Link><Link className="inline-link" to="/ajustes">Perfil</Link></div>{notice && <SavedNotice>{notice}</SavedNotice>}{error && <p role="alert" className="field-error">{error}</p>}{!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : <div className="routine-settings-list">{ROUTINE_GROUPS.map(group => <section key={group.name}><h2 className="text-[19px] font-semibold mb-3">{group.name}</h2><div className="routine-settings-list">{data.routines.filter(item => group.kinds.includes(item.kind)).map(item => <article className="tracking-panel" key={item.id}><div className="section-heading"><button className="routine-name-button" onClick={() => setSelected(item.id)}><h2>{item.name}</h2><span className="helper">{KIND_LABELS[item.kind]} · {item.enabled ? 'Ativo' : 'Desativado'}</span></button><button type="button" className="btn-secondary" role="switch" aria-checked={item.enabled} aria-label={`${item.enabled ? 'Desativar' : 'Ativar'} ${item.name}`} disabled={busy} onClick={() => void action(() => saveRoutine({ ...item, schedule: [...(item.scheduleChanges ?? [])].sort((a, b) => b.from.localeCompare(a.from))[0]?.schedule ?? item.schedule, enabled: !item.enabled }), item.enabled ? 'Acompanhamento desativado. Histórico preservado.' : 'Acompanhamento ativado.')}>{item.enabled ? 'Desativar' : 'Ativar'}</button></div><button className="inline-link mt-3" onClick={() => setSelected(item.id)}>Configurar e ver metas<CaretRight size={17} /></button></article>)}</div></section>)}</div>}{selected && routine && !editing && !goalEditor && <BottomSheet title={routine.name} description="Configurações e metas independentes." onClose={() => setSelected(null)}><div className="tracking-fields"><button className="btn-secondary" onClick={() => setEditing(routine)}>Editar acompanhamento e frequência</button>{data.goals.filter(goal => goal.routineId === routine.id).map(goal => <div className="routine-goal-editor-row" key={goal.id}><RoutineGoalStatus goal={goal} routine={routine} data={data} />{(!goal.endDate || goal.endDate >= data.today) && <div className="flex flex-wrap gap-4 mt-3"><button className="inline-link" onClick={() => setGoalEditor(goal)}>Alterar meta</button><button className="inline-link" disabled={busy} onClick={() => void action(() => endRoutineGoal(goal.id), 'Meta encerrada ao final do período atual.')}>Encerrar meta</button></div>}</div>)}<button className="btn-primary" onClick={() => setGoalEditor('new')}><Plus size={18} />Adicionar meta</button><p className="helper">Você pode acompanhar sem meta. As metas de exercícios gerais e de cada modalidade usam as mesmas sessões.</p>{error && <p role="alert" className="field-error">{error}</p>}</div></BottomSheet>}{editing && <BottomSheet title={editing === 'new' ? 'Novo hábito de saúde' : editing.name} onClose={() => setEditing(null)}><RoutineEditor routine={editing === 'new' ? undefined : editing} data={data} onSaved={() => { setEditing(null); setNotice('Acompanhamento salvo.') }} /></BottomSheet>}{goalEditor && routine && <BottomSheet title={`Meta · ${routine.name}`} onClose={() => setGoalEditor(null)}><GoalEditor routine={routine} data={data} goal={goalEditor === 'new' ? undefined : goalEditor} onSaved={() => { setGoalEditor(null); setNotice('Meta salva.') }} /></BottomSheet>}</main>
}

