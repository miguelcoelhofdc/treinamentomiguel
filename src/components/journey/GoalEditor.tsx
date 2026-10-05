import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, PencilSimple, SpinnerGap } from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import { db } from '@/db'
import { addCalendarDays, isDateKey, localDateKey } from '@/lib/date'
import { ACTIVITIES, GOAL_KINDS, validateGoal } from '@/lib/continuousTraining'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'
import type { TrainingGoal, TrainingSettings } from '@/types'

export default function GoalEditor({ settings, updateSetting, compact = false }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  if (settings.coaching) return <Link to="/coaching" className={compact ? 'btn-ghost' : 'btn-primary'} aria-label="Ajustar objetivo e disponibilidade">{compact ? 'Editar' : 'Ajustar objetivo e disponibilidade'}</Link>
  return <>
    <button type="button" className={compact ? 'btn-icon' : 'btn-primary'} aria-label={settings.primaryGoal ? 'Editar minha meta' : 'Definir minha meta'} onClick={() => setOpen(true)}><PencilSimple size={19} weight="bold" />{!compact && (settings.primaryGoal ? 'Editar minha meta' : 'Definir minha meta')}</button>
    {open && <GoalsForm settings={settings} updateSetting={updateSetting} onClose={() => setOpen(false)} />}
  </>
}

function GoalsForm({ settings, updateSetting, onClose }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting; onClose: () => void }) {
  const today = localDateKey(), current = settings.primaryGoal
  const [newGoal, setNewGoal] = useState(!current)
  const [title, setTitle] = useState(current?.title ?? '')
  const [kind, setKind] = useState<TrainingGoal['kind']>(current?.kind ?? 'minutes')
  const [activity, setActivity] = useState(current?.activity ?? 'all')
  const [customName, setCustomName] = useState('')
  const [target, setTarget] = useState(current ? String(current.target) : '')
  const [distance, setDistance] = useState(current?.distanceKm ? String(current.distanceKm) : '')
  const [start, setStart] = useState(current?.startDate ?? today)
  const [deadline, setDeadline] = useState<'none' | 'date' | 'days'>(current?.endDate ? 'date' : 'none')
  const [end, setEnd] = useState(current?.endDate ?? '')
  const [days, setDays] = useState('30')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const number = (raw: string) => Number(raw.replace(',', '.'))
  const archive = () => current ? [...settings.goalHistory, { ...current, archivedAt: today < current.startDate ? current.startDate : today }] : settings.goalHistory
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    let endDate: string | undefined
    if (deadline === 'date') endDate = end
    if (deadline === 'days') {
      if (!isDateKey(start) || !Number.isInteger(number(days)) || number(days) < 1 || number(days) > 36500) { setError('Informe uma duração de 1 a 36500 dias.'); return }
      endDate = addCalendarDays(start, number(days) - 1)
    }
    const selected = kind === 'weight' ? 'peso' : kind === 'runTime' ? 'corrida' : activity === 'new' ? `custom:${customName.trim()}` : activity
    if (activity === 'new' && !['weight', 'runTime'].includes(kind) && (!customName.trim() || customName.trim().length > 80)) { setError('Dê um nome à atividade, com até 80 caracteres.'); return }
    const goal: TrainingGoal = { id: newGoal ? crypto.randomUUID() : current!.id, title: title.trim(), kind, activity: selected, target: number(target), startDate: start, ...(endDate ? { endDate } : {}), ...(kind === 'runTime' ? { distanceKm: number(distance) } : {}) }
    if ((deadline !== 'none' && !endDate) || !validateGoal(goal)) { setError('Preencha o nome, um valor maior que zero e datas válidas. A data final deve ser igual ou posterior ao início.'); return }
    setBusy(true); setError('')
    try {
      if (kind === 'weight') {
        const cutoff = start < today ? start : today
        const weights = (await db.dailyLogs.toArray()).filter(log => isDateKey(log.date) && log.date <= cutoff && log.weightKg != null).sort((a, b) => a.date.localeCompare(b.date))
        goal.baseline = !newGoal && current?.kind === 'weight' && current.startDate === start && current.baseline != null ? current.baseline : weights.at(-1)?.weightKg ?? settings.initialWeight
      }
      await db.transaction('rw', db.settings, async () => {
        if (newGoal && current) await updateSetting('goalHistory', archive())
        if (selected.startsWith('custom:')) await updateSetting('customActivities', [...new Set([...settings.customActivities, selected.slice(7)])])
        await updateSetting('primaryGoal', goal)
        if (kind === 'weight') await updateSetting('goalWeight', goal.target)
      })
      onClose()
    } catch { setError('Não foi possível salvar sua meta. Tente novamente.'); setBusy(false) }
  }
  const finish = async () => {
    setBusy(true); setError('')
    try { await db.transaction('rw', db.settings, async () => { await updateSetting('goalHistory', archive()); await updateSetting('primaryGoal', null) }); onClose() }
    catch { setError('Não foi possível encerrar sua meta. Tente novamente.'); setBusy(false) }
  }
  return <BottomSheet title={newGoal ? 'Qual é sua próxima meta?' : 'Sua meta, seu ritmo'} description="Escolha o que quer alcançar. Seu acompanhamento continua com ou sem uma meta." onClose={onClose}>
    <form onSubmit={event => void save(event)} className="space-y-5" noValidate>
      <fieldset disabled={busy} className="space-y-4">
        <div><label className="label" htmlFor="goal-title">Nome da meta</label><input id="goal-title" className="input" value={title} maxLength={120} placeholder="Ex.: dedicar mais tempo à caminhada" onChange={event => setTitle(event.target.value)} /></div>
        <div><label className="label" htmlFor="goal-kind">O que você quer alcançar?</label><select id="goal-kind" className="input" value={kind} onChange={event => setKind(event.target.value as TrainingGoal['kind'])}>{Object.entries(GOAL_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        {!['weight', 'runTime'].includes(kind) && <div><label className="label" htmlFor="goal-activity">Tipo de atividade</label><select id="goal-activity" className="input" value={activity} onChange={event => setActivity(event.target.value)}><option value="all">Todas as atividades</option>{ACTIVITIES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{settings.customActivities.map(name => <option key={name} value={`custom:${name}`}>{name}</option>)}<option value="new">Outra atividade…</option></select>{activity === 'new' && <><label className="label mt-3" htmlFor="goal-custom">Nome da atividade</label><input id="goal-custom" className="input" value={customName} maxLength={80} placeholder="Ex.: ciclismo" onChange={event => setCustomName(event.target.value)} /></>}</div>}
        {kind === 'runTime' && <div><label className="label" htmlFor="goal-distance">Distância da corrida · km</label><input id="goal-distance" className="input" inputMode="decimal" value={distance} placeholder="Ex.: 5" onChange={event => setDistance(event.target.value)} /></div>}
        <div><label className="label" htmlFor="goal-target">{kind === 'weight' ? 'Peso desejado · kg' : kind === 'sessions' ? 'Quantidade de atividades' : kind === 'distance' ? 'Distância total · km' : kind === 'runTime' ? 'Tempo máximo da corrida · minutos' : 'Tempo total · minutos'}</label><input id="goal-target" className="input" inputMode="decimal" value={target} placeholder={kind === 'minutes' ? 'Ex.: 600' : 'Valor definido por você'} onChange={event => setTarget(event.target.value)} /><p className="helper">{kind === 'runTime' ? 'Use vírgula para frações de minuto: 30,5 equivale a 30 min e 30 s.' : kind === 'minutes' ? 'O tempo é somado desde o início da meta, sem reinício periódico.' : 'São considerados os registros dentro do período escolhido.'}</p></div>
        <div><label className="label" htmlFor="goal-start">Início da meta</label><input id="goal-start" type="date" className="input" value={start} onChange={event => setStart(event.target.value)} /></div>
        <div><label className="label" htmlFor="goal-deadline">Prazo</label><select id="goal-deadline" className="input" value={deadline} onChange={event => setDeadline(event.target.value as typeof deadline)}><option value="none">Sem prazo</option><option value="date">Escolher data final</option><option value="days">Definir duração em dias</option></select></div>
        {deadline === 'date' && <div><label className="label" htmlFor="goal-end">Data final</label><input id="goal-end" type="date" className="input" min={start} value={end} onChange={event => setEnd(event.target.value)} /></div>}
        {deadline === 'days' && <div><label className="label" htmlFor="goal-days">Duração · dias</label><input id="goal-days" className="input" inputMode="numeric" value={days} onChange={event => setDays(event.target.value)} /></div>}
      </fieldset>
      {error && <p role="alert" className="text-[13px] text-red-600 dark:text-red-300">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? <SpinnerGap size={20} className="animate-spin" /> : <Check size={20} weight="bold" />}{busy ? 'Salvando…' : 'Salvar minha meta'}</button>
      {current && !newGoal && <div className="flex flex-col gap-2"><button type="button" disabled={busy} className="btn-secondary w-full" onClick={() => { setNewGoal(true); setTitle(''); setTarget(''); setStart(today); setDeadline('none'); setError('') }}>Criar próxima meta</button><button type="button" disabled={busy} className="btn-ghost w-full" onClick={() => void finish()}>Encerrar meta e continuar acompanhando</button></div>}
    </form>
  </BottomSheet>
}
