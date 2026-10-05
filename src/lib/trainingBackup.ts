import type { ActivityLog, AppSettings, DailyLog, ExerciseCheck, Plan, PlannedSession, RunningLog, StrengthLog, WorkoutTemplate } from '../types/index.ts'
import { isDateKey } from './date.ts'
import { isActivityLog, validateGoal } from './continuousTraining.ts'
import { parsePerformanceTargets } from './trainingSettings.ts'
import { validateCoaching, validatePlannedSession } from './coaching.ts'
import { validDailyRatings, validTemplate } from './tracking.ts'

export interface TrainingBackup {
  kind?: string
  schemaVersion?: number
  exportedAt?: string
  daily: DailyLog[]
  running: RunningLog[]
  strength: StrengthLog[]
  settings: AppSettings[]
  exerciseChecks: ExerciseCheck[]
  activities: ActivityLog[]
  plannedSessions: PlannedSession[]
  workoutTemplates: WorkoutTemplate[]
}

const FIELDS = ['daily', 'running', 'strength', 'settings', 'exerciseChecks', 'activities', 'plannedSessions', 'workoutTemplates'] as const
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const number = (value: unknown) => value == null || (typeof value === 'number' && Number.isFinite(value))
const string = (value: unknown) => value == null || typeof value === 'string'
const unique = (values: string[]) => new Set(values).size === values.length

export function parseTrainingBackup(raw: string, plan: Plan): TrainingBackup {
  const parsed: unknown = JSON.parse(raw)
  if (!object(parsed) || !FIELDS.some(field => field in parsed)) throw new Error('O arquivo não contém dados reconhecidos.')
  if (parsed.schemaVersion != null && (!Number.isInteger(parsed.schemaVersion) || Number(parsed.schemaVersion) < 1 || Number(parsed.schemaVersion) > 4)) throw new Error('Versão de backup incompatível.')
  for (const field of FIELDS) if (parsed[field] != null && !Array.isArray(parsed[field])) throw new Error(`A seção ${field} do backup é inválida.`)
  const payload = Object.fromEntries(FIELDS.map(field => [field, parsed[field] ?? []])) as unknown as TrainingBackup
  payload.kind = typeof parsed.kind === 'string' ? parsed.kind : undefined
  payload.schemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : undefined
  payload.exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined
  const validDate = (value: unknown) => typeof value === 'string' && isDateKey(value)
  const validDaily = (value: unknown): boolean => object(value) && (validDate(value.date) || value.date === '__tests__')
    && ['weightKg', 'sleepH', 'energy', 'shoulderPain', 'kneePain', 'rpe'].every(key => number(value[key]))
    && validDailyRatings(value as unknown as DailyLog) && string(value.notes)
    && ['workoutDone', 'checkInDone', 'lightVolume'].every(key => value[key] == null || typeof value[key] === 'boolean')
    && string(value.sessionType) && string(value.sessionName)
    && (value.trainingLevel == null || ['base', 'desenvolvimento', 'performance'].includes(String(value.trainingLevel)))
  const validRun = (value: unknown): boolean => object(value) && validDate(value.date) && ['qualidade', 'longa', 'livre'].includes(String(value.type))
    && typeof value.distanceKm === 'number' && Number.isFinite(value.distanceKm) && value.distanceKm > 0
    && typeof value.durationMin === 'number' && Number.isFinite(value.durationMin) && value.durationMin > 0
    && ['paceMinKm', 'hrAvg', 'effort'].every(key => number(value[key])) && string(value.notes)
  const validStrength = (value: unknown): boolean => object(value) && validDate(value.date) && typeof value.exercise === 'string' && Boolean(value.exercise.trim())
    && Array.isArray(value.sets) && value.sets.every(set => object(set) && typeof set.weightKg === 'number' && Number.isFinite(set.weightKg) && set.weightKg >= 0 && typeof set.reps === 'number' && Number.isFinite(set.reps) && Number.isInteger(set.reps) && set.reps > 0)
    && string(value.notes) && string(value.exerciseId) && string(value.activityLogId)
  if (!payload.daily.every(validDaily) || !payload.running.every(validRun) || !payload.strength.every(validStrength)
    || !payload.settings.every(value => object(value) && typeof value.key === 'string' && typeof value.value === 'string')
    || !payload.exerciseChecks.every(value => object(value) && validDate(value.date) && typeof value.exerciseId === 'string' && typeof value.done === 'boolean')
    || !payload.activities.every(value => isActivityLog(value) && string(value.createdAt) && string(value.updatedAt) && string(value.notes) && string(value.templateId))
    || !payload.plannedSessions.every(validatePlannedSession) || !unique(payload.plannedSessions.map(value => value.id))
    || !payload.workoutTemplates.every(validTemplate) || !unique(payload.workoutTemplates.map(value => value.id))
    || !unique(payload.activities.map(value => value.id))) throw new Error('Há registros corrompidos ou incompatíveis no backup.')
  const activityIds = new Set(payload.activities.map(activity => activity.id))
  if (payload.strength.some(record => record.activityLogId && !activityIds.has(record.activityLogId))) throw new Error('Há séries vinculadas a um treino ausente no backup.')
  for (const { key, value } of payload.settings) {
    if (key === 'coaching' && JSON.parse(value) !== null && !validateCoaching(JSON.parse(value))) throw new Error('Configuração de coaching inválida no backup.')
    if (key === 'performanceTargets') parsePerformanceTargets(value, plan)
    if (key === 'primaryGoal' && JSON.parse(value) !== null && !validateGoal(JSON.parse(value))) throw new Error('Meta principal inválida no backup.')
    if (key === 'goalHistory' && (!Array.isArray(JSON.parse(value)) || !JSON.parse(value).every(validateGoal))) throw new Error('Histórico de metas inválido no backup.')
    if (key === 'trainingLevel' && !['base', 'desenvolvimento', 'performance'].includes(value)) throw new Error('Nível de treino inválido no backup.')
    if (key === 'lightVolume' && !['true', 'false'].includes(value)) throw new Error('Volume de treino inválido no backup.')
    if (key === 'sessionDurationMin' && (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 1440)) throw new Error('Tempo de treino inválido no backup.')
    if (key === 'customActivities' && (!Array.isArray(JSON.parse(value)) || !JSON.parse(value).every((item: unknown) => typeof item === 'string' && item.trim().length > 0 && item.length <= 80))) throw new Error('Atividades inválidas no backup.')
    if (key === 'startDate' && !isDateKey(value)) throw new Error('Data de início inválida no backup.')
  }
  return payload
}

export function backupRecordCount(payload: TrainingBackup): number {
  return FIELDS.reduce((total, field) => total + payload[field].length, 0)
}
