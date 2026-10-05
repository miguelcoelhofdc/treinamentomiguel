import type { CoachingSettings, DailyLog, Exercise, ExercisePhaseData, PhaseId, Plan, PlannedSession, SessionBlock } from '../types/index.ts'
import { addCalendarDays, calendarDay, isDateKey, weekday } from './date.ts'

export const COACHING_OBJECTIVES = [
  { id: 'consistency', title: 'Treinar mais', description: 'Uma rotina equilibrada que cabe na sua semana.', icon: 'forca' },
  { id: 'muscle', title: 'Ganhar massa muscular', description: 'Treinos de força e evolução de cargas e repetições.', icon: 'forca' },
  { id: 'running', title: 'Correr', description: 'Do primeiro trote a uma corrida mais consistente.', icon: 'corrida' },
  { id: 'active', title: 'Ficar mais ativo', description: 'Movimento simples para fazer parte do seu dia.', icon: 'caminhada' },
] as const
export const COACHING_LEVELS: Record<PhaseId, string> = { base: 'Começando ou retomando', desenvolvimento: 'Já treino regularmente', performance: 'Tenho bastante experiência' }
const phases: PhaseId[] = ['base', 'desenvolvimento', 'performance']
export function objectiveTitle(id: CoachingSettings['objective']) { return COACHING_OBJECTIVES.find(item => item.id === id)!.title }
export function suggestedWeekdays(count: number, date: string) {
  return Array.from({ length: Math.max(1, Math.min(7, count)) }, (_, index) => (weekday(date) + Math.floor(index * 7 / count)) % 7).sort((a, b) => a - b)
}
export function validateCoaching(value: unknown): value is CoachingSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const c = value as CoachingSettings
  return c.version === 1 && typeof c.id === 'string' && c.id.length > 0 && c.id.length <= 100
    && Number.isSafeInteger(c.revision) && c.revision > 0 && COACHING_OBJECTIVES.some(item => item.id === c.objective)
    && isDateKey(c.startDate) && isDateKey(c.effectiveDate) && c.effectiveDate >= c.startDate
    && Array.isArray(c.weekdays) && c.weekdays.length > 0 && c.weekdays.length <= 7 && new Set(c.weekdays).size === c.weekdays.length && c.weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
    && Number.isInteger(c.minutes) && c.minutes >= 5 && c.minutes <= 180 && phases.includes(c.level)
    && ['gym', 'home', 'outdoors'].includes(c.location)
    && Array.isArray(c.equipment) && c.equipment.every(item => ['gym', 'dumbbells', 'band', 'bench'].includes(item))
    && (c.location === 'gym' ? c.equipment.includes('gym') : !c.equipment.includes('gym'))
    && Array.isArray(c.restrictions) && c.restrictions.every(item => ['shoulder', 'knee'].includes(item))
    && ['new', 'intervals', 'continuous'].includes(c.runningAbility)
}

type CatalogEntry = { exercise: Exercise; equipment: CoachingSettings['equipment']; restrictions: CoachingSettings['restrictions']; group: 'legs' | 'push' | 'pull' | 'core' }
function homeExercise(id: string, name: string, technique: string, equipment = 'Nenhum'): Exercise {
  return { id, name, technique, equipment, category: 'compound', caution: null, cautionNote: null, phases: {
    base: { sets: 2, reps: '8–10', rest: '60s' }, desenvolvimento: { sets: 3, reps: '10–12', rest: '60s' }, performance: { sets: 3, reps: '12–15', rest: '75s' },
  } }
}
const HOME_CATALOG: CatalogEntry[] = [
  { exercise: homeExercise('coach-chair', 'Sentar e levantar', 'Use uma cadeira firme encostada na parede. Sente e levante devagar, sem dor.', 'Banco ou cadeira firme'), equipment: ['bench'], restrictions: ['knee'], group: 'legs' },
  { exercise: homeExercise('coach-bridge', 'Ponte de glúteos', 'Deitado, pés apoiados e joelhos dobrados. Eleve o quadril sem arquear a lombar.'), equipment: [], restrictions: ['knee'], group: 'legs' },
  { exercise: homeExercise('coach-wall-push', 'Flexão na parede', 'Mãos na parede, corpo alinhado. Flexione os cotovelos com controle e volte.'), equipment: [], restrictions: ['shoulder'], group: 'push' },
  { exercise: homeExercise('coach-band-row', 'Remada com elástico', 'Prenda o elástico em apoio seguro. Puxe mantendo os cotovelos próximos ao corpo.', 'Elástico'), equipment: ['band'], restrictions: ['shoulder'], group: 'pull' },
  { exercise: homeExercise('coach-dumbbell-row', 'Remada com halter', 'Apoie uma mão em superfície firme. Puxe o halter junto ao corpo, sem girar o tronco.', 'Halteres'), equipment: ['dumbbells'], restrictions: ['shoulder'], group: 'pull' },
  { exercise: homeExercise('coach-deadbug', 'Dead bug', 'Deitado, mantenha a lombar apoiada. Alterne lentamente braço e perna opostos. Conte cada lado.'), equipment: [], restrictions: ['shoulder'], group: 'core' },
  { exercise: homeExercise('coach-march', 'Marcha controlada', 'Marche em pé em ritmo confortável. Mantenha os pés próximos do chão e use apoio firme se necessário.'), equipment: [], restrictions: ['knee'], group: 'legs' },
  { exercise: homeExercise('coach-core', 'Ativação abdominal deitado', 'Deitado com os pés apoiados, contraia suavemente o abdômen por 4 segundos e relaxe, respirando normalmente.'), equipment: [], restrictions: [], group: 'core' },
]
const GYM_GROUPS: Record<string, CatalogEntry['group']> = {
  agachamento: 'legs', legpress: 'legs', legcurl: 'legs', hip_thrust: 'legs', goblet: 'legs',
  supino_halter: 'push', remada_halter: 'pull', remada_unilateral: 'pull', triceps_corda: 'push',
  'sintia-legpress': 'legs', 'sintia-supino': 'push', 'sintia-remada': 'pull', 'sintia-legcurl': 'legs', 'sintia-supino-maquina': 'push', 'sintia-remada-sentada': 'pull', 'sintia-mesa-flexora': 'legs',
  'sintia-agachamento-goblet': 'legs', 'sintia-puxada': 'pull', 'sintia-romeno': 'legs', 'sintia-pallof': 'core',
}
function catalog(plan: Plan, config: CoachingSettings, pain = false): CatalogEntry[] {
  const gym: CatalogEntry[] = [...plan.exercises.forcaA, ...plan.exercises.forcaB, ...plan.exercises.forcaC]
    .filter(exercise => GYM_GROUPS[exercise.id]).map(exercise => ({ exercise, equipment: ['gym'], restrictions: GYM_GROUPS[exercise.id] === 'legs' ? ['knee'] : ['shoulder'], group: GYM_GROUPS[exercise.id] }))
  const restrictions = pain ? ['shoulder', 'knee'] : config.restrictions
  return [...gym, ...HOME_CATALOG].filter(entry => entry.equipment.every(item => config.equipment.includes(item)) && !entry.restrictions.some(item => restrictions.includes(item)))
}
const block = (id: string, label: string, instruction: string, seconds: number): SessionBlock => ({ id, label, instruction, durationSeconds: seconds })
function recovery(config: CoachingSettings, date: string, reason: string): PlannedSession {
  return { id: `coach:${date}`, date, coachingId: config.id, revision: config.revision, objective: config.objective, templateKey: 'recovery', stage: 0, phase: config.level, activity: 'descanso', label: 'Recuperação', reason, blocks: [], estimatedMinutes: 0, isTraining: false, light: true, status: 'recovery' }
}
export function hasSessionPain(log?: DailyLog) { return (log?.shoulderPain ?? 0) > 0 || (log?.kneePain ?? 0) > 0 }
function progression(config: CoachingSettings, key: string, sessions: PlannedSession[]) {
  const rows = sessions.filter(item => item.coachingId === config.id && item.templateKey === key && item.status === 'completed').sort((a, b) => a.date.localeCompare(b.date))
  const last = rows.at(-1)
  const latestSession = sessions.filter(item => item.coachingId === config.id && item.status === 'completed').sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const baseline = key === 'run' ? config.runningAbility === 'new' ? 0 : config.runningAbility === 'intervals' ? 1 : 6 : phases.indexOf(config.level)
  if (!last) return { stage: baseline, light: latestSession?.pain === true }
  const lastStage = Math.max(baseline, last.stage)
  const qualifying = rows.slice(-2)
  const canAdvance = !latestSession?.pain && qualifying.length === 2 && qualifying.every(item => item.stage === lastStage && !item.light && !item.pain && (item.feedback === 'easy' || item.feedback === 'okay'))
  return { stage: Math.min(key === 'run' ? 8 : 2, lastStage + (canAdvance ? 1 : 0)), light: last.feedback === 'hard' || last.pain === true || latestSession?.pain === true }
}

function training(config: CoachingSettings, plan: Plan, date: string, kind: 'strength' | 'run' | 'walk' | 'movement', slot: number, history: PlannedSession[], log?: DailyLog): PlannedSession {
  const key = kind === 'strength' ? `strength:${slot % 2 ? 'B' : 'A'}` : kind
  const progress = progression(config, key, history)
  const pain = hasSessionPain(log)
  const light = progress.light || (log?.energy != null && log.energy <= 2)
  const stage = light ? Math.max(0, progress.stage - 1) : progress.stage
  const budget = config.minutes * 60
  let activity: PlannedSession['activity'] = kind === 'strength' ? 'forca' : kind === 'run' ? 'corrida' : kind === 'walk' ? 'caminhada' : 'mobilidade'
  let label = kind === 'strength' ? 'Força — corpo inteiro' : kind === 'run' ? 'Caminhada + corrida' : kind === 'walk' ? 'Caminhada confortável' : 'Movimento e mobilidade'
  let reason = kind === 'strength' ? 'Força para construir sua rotina e acompanhar a evolução dos movimentos.' : kind === 'run' ? 'Corrida no seu nível, com recuperação entre as sessões.' : kind === 'walk' ? 'Movimento acessível para manter a constância.' : 'Uma sessão leve para movimentar o corpo e recuperar.'
  let blocks: SessionBlock[] = []
  if (pain) return recovery(config, date, 'Você registrou dor. Hoje o plano prioriza recuperação; a progressão fica pausada.')
  if (kind === 'strength') {
    const available = catalog(plan, config)
    const groups: CatalogEntry['group'][] = slot % 2 ? ['pull', 'legs', 'push', 'core'] : ['legs', 'push', 'pull', 'core']
    const chosen = groups.map(group => available.find(entry => entry.group === group)).filter((entry): entry is CatalogEntry => !!entry)
    if (config.restrictions.length) reason += ' Movimentos incompatíveis com suas limitações foram retirados.'
    const warmup = block('warmup', 'Aquecimento · 2 min', 'Caminhe ou marche devagar, sem impacto, em ritmo confortável.', 120)
    const cooldown = block('cooldown', 'Encerramento · 1 min', 'Diminua o ritmo e respire com calma.', 60)
    blocks = [warmup]
    let used = warmup.durationSeconds + cooldown.durationSeconds
    const sets = light ? 1 : config.objective === 'muscle' ? 2 + stage : 2 + (stage > 0 ? 1 : 0)
    for (const entry of chosen) {
      const reps = 8 + stage * 2
      const rest = stage === 2 ? 75 : 60
      // Upper end of the rep range, controlled 4-second reps, all pauses and a transition.
      const duration = sets * (reps + 2) * 4 + Math.max(0, sets - 1) * rest + 30
      if (used + duration > budget) continue
      const prescription: ExercisePhaseData = { sets, reps: `${reps}–${reps + 2}`, rest: `${rest}s` }
      blocks.push({ id: entry.exercise.id, label: entry.exercise.name, instruction: entry.exercise.technique, durationSeconds: duration, exercise: entry.exercise, prescription })
      used += duration
    }
    if (blocks.length < 3) {
      activity = 'mobilidade'; label = 'Preparação curta'; reason = 'Seu tempo, equipamento ou limitações não comportam uma sessão completa de força. Hoje faremos uma preparação curta.'
      blocks = [block('short', 'Movimento confortável', 'Em uma posição confortável, em pé ou sentado, alterne 1 min de respiração tranquila e 1 min de pequenos movimentos confortáveis. Não force as articulações e interrompa qualquer movimento doloroso.', Math.min(budget, 600))]
    } else {
      blocks.push(cooldown)
      if (chosen.length < 4 || blocks.length < 6) label = 'Força — rotina adaptada'
      if (blocks.length < chosen.length + 2) reason += ' A sessão foi encurtada para caber no tempo disponível.'
      if (!available.some(entry => entry.group === 'pull')) reason += ' Um elástico ou halteres ampliam as opções de puxada.'
    }
  } else if (kind === 'run' && budget >= 900 && !config.restrictions.includes('knee')) {
    const warm = 300, cool = 300
    const workMinutes = light ? 10 : config.runningAbility === 'continuous' ? 20 + Math.max(0, stage - 6) * 5 : 15 + Math.min(stage, 4) * 5
    const available = Math.min(budget - warm - cool, workMinutes * 60)
    blocks = [block('warmup', 'Aquecimento · 5 min', 'Caminhe confortavelmente e aumente o ritmo aos poucos.', warm)]
    if (config.runningAbility === 'continuous' && !light) {
      label = 'Corrida confortável'
      blocks.push(block('run', `Corrida · ${Math.floor(available / 60)} min`, 'Corra em ritmo em que consegue conversar. Hoje o foco é completar o tempo, sem perseguir o pace alvo.', available))
    } else {
      // Structured walk/run stages inspired by NHS Couch to 5K. Progress follows
      // completed sessions, never a promised nine-week deadline or a target pace.
      const stages = [[60, 90], [90, 120], [180, 180], [300, 150], [480, 180], [600, 180], [1500, 0], [1680, 0], [1800, 0]]
      const [run, walk] = stages[stage]
      const cycles = Math.max(1, Math.floor(available / (run + walk)))
      if (run + walk > available || walk === 0) {
        const duration = Math.min(available, run)
        label = 'Corrida confortável'
        blocks.push(block('run', `Trote confortável · ${Math.floor(duration / 60)} min`, 'Corra em ritmo conversável. Se precisar, caminhe até recuperar a respiração; não tente compensar acelerando.', duration))
      } else blocks.push(block('intervals', `${cycles} ciclos de trote e caminhada`, `${cycles} × ${run}s de trote confortável + ${walk}s de caminhada. Use um cronômetro e mantenha o ritmo conversável.`, cycles * (run + walk)))
    }
    blocks.push(block('cooldown', 'Encerramento · 5 min', 'Finalize com caminhada leve.', cool))
  } else if (kind === 'movement') {
    const duration = Math.min(budget, (light ? 10 : 10 + stage * 5) * 60)
    blocks = [block('movement', `Movimento leve · ${duration / 60} min`, 'Alterne 2 min de marcha ou caminhada confortável e 1 min de pausa com respiração tranquila. Não force amplitude nem movimentos dolorosos.', duration)]
  } else {
    activity = 'caminhada'; label = kind === 'run' ? 'Caminhada de preparação' : label
    const duration = Math.min(budget, (light ? 10 : 15 + stage * 10) * 60)
    const edge = Math.min(120, Math.floor(duration / 4))
    blocks = [block('warmup', 'Comece devagar', 'Caminhe lentamente para aquecer.', edge), block('walk', 'Caminhada confortável', 'Mantenha um ritmo em que consegue conversar, em local plano e seguro. Em casa, marche sem impacto.', duration - edge * 2), block('cooldown', 'Diminua o ritmo', 'Finalize devagar e respire com calma.', edge)]
    if (kind === 'run') reason = config.restrictions.includes('knee') ? 'Sua limitação no joelho foi considerada. O plano começa com caminhada confortável, sem trote.' : 'Hoje seu tempo comporta uma caminhada de preparação. Para blocos de corrida, reserve pelo menos 15 min.'
  }
  if (light) reason += ' Versão leve escolhida pelo seu acompanhamento.'
  const templateKey = kind === 'strength' && activity !== 'forca' ? 'preparation' : kind === 'run' && activity !== 'corrida' ? 'walk:preparation' : key
  return { ...recovery(config, date, reason), templateKey, stage: progress.stage, phase: phases[Math.min(2, stage)], activity, label, reason, blocks, estimatedMinutes: Math.ceil(blocks.reduce((sum, item) => sum + item.durationSeconds, 0) / 60), isTraining: true, light, status: 'planned' }
}

function sequence(config: CoachingSettings): ('strength' | 'run' | 'walk' | 'movement')[] {
  if (config.objective === 'active') return ['walk', 'movement', 'walk']
  if (config.objective === 'running') return ['run', 'movement', 'run', 'walk']
  if (config.objective === 'muscle') return ['strength', 'strength', 'movement']
  return ['strength', 'walk', 'strength', 'movement']
}
/** Deterministic projection. Future previews never count as evidence of progression. */
export function buildCoachingPlan(config: CoachingSettings, plan: Plan, stored: PlannedSession[], daily: DailyLog[], today: string, through = addCalendarDays(today, 41)): PlannedSession[] {
  const byDate = new Map(stored.map(item => [item.date, item]))
  const logs = new Map<string, DailyLog>()
  for (const item of [...daily].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) logs.set(item.date, { ...logs.get(item.date), ...item })
  const history = stored.filter(item => item.date <= today).sort((a, b) => a.date.localeCompare(b.date))
  let cursor = history.filter(item => item.coachingId === config.id && item.isTraining && item.status === 'completed' && item.date < today).length
  const kinds = sequence(config)
  const result = stored.filter(item => item.date < today).map(item => item.status === 'planned' || item.status === 'started' ? { ...item, status: 'missed' as const } : item)
  // If the app stayed closed beyond its saved preview, restore the commitment
  // under the known configuration without inventing a completed activity.
  for (let date = config.effectiveDate; date < today; date = addCalendarDays(date, 1)) {
    if (byDate.has(date)) continue
    const past = config.weekdays.includes(weekday(date)) ? training(config, plan, date, kinds[0], 0, [], undefined) : recovery(config, date, 'Dia de recuperação previsto na sua agenda.')
    result.push(past.isTraining ? { ...past, status: 'missed' } : past)
  }
  const start = today < config.effectiveDate ? config.effectiveDate : today
  if (today < start) result.push(recovery(config, today, `Seu plano começa em ${config.effectiveDate.split('-').reverse().join('/')}. Até lá, consulte a agenda ou ajuste sua disponibilidade.`))
  let lastStrength = history.filter(item => item.date < today && item.status === 'completed' && item.activity === 'forca').at(-1)?.date
  let lastRun = history.filter(item => item.date < today && item.status === 'completed' && item.activity === 'corrida').at(-1)?.date
  const priorLogs = [...logs.values()].filter(log => log.date < today && log.workoutDone).sort((a, b) => a.date.localeCompare(b.date))
  const loggedStrength = priorLogs.filter(log => log.sessionType?.startsWith('forca')).at(-1)?.date
  const loggedRun = priorLogs.filter(log => ['corrida', 'qualidade', 'longa', 'livre'].includes(log.sessionType ?? '')).at(-1)?.date
  if (loggedStrength && (!lastStrength || loggedStrength > lastStrength)) lastStrength = loggedStrength
  if (loggedRun && (!lastRun || loggedRun > lastRun)) lastRun = loggedRun
  for (let date = start; date <= through; date = addCalendarDays(date, 1)) {
    const previous = byDate.get(date)
    if (previous && (previous.startedAt || previous.status === 'completed')) {
      result.push(previous)
      if (previous.isTraining) cursor++
      if (previous.activity === 'forca') lastStrength = date
      if (previous.activity === 'corrida') lastRun = date
      continue
    }
    if (date === today && logs.get(today)?.workoutDone) {
      result.push(recovery(config, date, 'Você já registrou uma atividade hoje. O novo planejamento começa na próxima sessão disponível; seu registro continua na Evolução.'))
      continue
    }
    if (!config.weekdays.includes(weekday(date))) {
      result.push(recovery(config, date, 'Dia reservado para recuperação. Sua próxima sessão segue a agenda escolhida.'))
      continue
    }
    let kind = kinds[cursor % kinds.length]
    // Full-body strength and runs are spaced; a light complement occupies consecutive slots.
    if (kind === 'strength' && lastStrength && calendarDay(date) - calendarDay(lastStrength) < 2) kind = 'movement'
    if (kind === 'run' && lastRun && calendarDay(date) - calendarDay(lastRun) < 2) kind = 'movement'
    const session = training(config, plan, date, kind, cursor, history, date === today ? logs.get(today) : undefined)
    result.push(session)
    cursor++
    if (session.activity === 'forca') lastStrength = date
    if (session.activity === 'corrida') lastRun = date
  }
  return result.sort((a, b) => a.date.localeCompare(b.date))
}
export function coachingAdherence(sessions: PlannedSession[], today: string, from?: string, through = today) {
  const due = sessions.filter(item => item.isTraining && (!from || item.date >= from) && item.date <= through && item.date <= today && (item.date < today || item.status === 'completed'))
  const completed = due.filter(item => item.status === 'completed').length
  return { due: due.length, completed, percent: due.length ? Math.round(completed / due.length * 100) : null }
}
export function validatePlannedSession(value: unknown): value is PlannedSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const s = value as PlannedSession
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
  return isDateKey(s.date) && s.id === `coach:${s.date}` && typeof s.coachingId === 'string' && !!s.coachingId
    && Number.isSafeInteger(s.revision) && s.revision > 0 && COACHING_OBJECTIVES.some(item => item.id === s.objective)
    && typeof s.templateKey === 'string' && typeof s.label === 'string' && typeof s.reason === 'string'
    && Number.isInteger(s.stage) && s.stage >= 0 && s.stage <= 8 && phases.includes(s.phase)
    && ['forca', 'corrida', 'caminhada', 'mobilidade', 'descanso'].includes(s.activity)
    && ['planned', 'started', 'completed', 'missed', 'recovery'].includes(s.status)
    && typeof s.isTraining === 'boolean' && typeof s.light === 'boolean' && number(s.estimatedMinutes)
    && (s.startedAt == null || (typeof s.startedAt === 'string' && Number.isFinite(Date.parse(s.startedAt))))
    && (s.feedback == null || ['easy', 'okay', 'hard'].includes(s.feedback)) && (s.pain == null || typeof s.pain === 'boolean')
    && [s.actualDurationMin, s.distanceKm].every(v => v == null || (number(v) && v > 0))
    && (s.activityLogId == null || typeof s.activityLogId === 'string')
    && Array.isArray(s.blocks) && s.blocks.every(b => b && typeof b.id === 'string' && typeof b.label === 'string' && typeof b.instruction === 'string' && number(b.durationSeconds)
      && (b.exercise == null || (typeof b.exercise.id === 'string' && typeof b.exercise.name === 'string' && typeof b.exercise.technique === 'string' && typeof b.exercise.category === 'string' && typeof b.exercise.equipment === 'string' && !!b.exercise.phases && phases.every(phase => b.exercise!.phases[phase] && number(b.exercise!.phases[phase].sets) && typeof b.exercise!.phases[phase].reps === 'string' && typeof b.exercise!.phases[phase].rest === 'string')))
      && (b.prescription == null || (Number.isInteger(b.prescription.sets) && b.prescription.sets > 0 && typeof b.prescription.reps === 'string' && typeof b.prescription.rest === 'string')))
    && new Set(s.blocks.map(b => b.id)).size === s.blocks.length
    && s.estimatedMinutes === Math.ceil(s.blocks.reduce((sum, b) => sum + b.durationSeconds, 0) / 60)
}
