export type PhaseId = 'base' | 'desenvolvimento' | 'performance'

export interface Phase {
  id: PhaseId
  name: string
  description: string
  color: string
}

export interface WeekDayTemplate {
  type: 'forca' | 'corrida' | 'calistenia' | 'descanso'
  subtype: string | null
  label: string
  icon: string
}

export interface ExercisePhaseData {
  sets: number
  reps: string
  rest: string
  variation?: string
  circuit?: string[]
}

export interface Exercise {
  id: string
  name: string
  category: string
  equipment: string
  phases: Record<PhaseId, ExercisePhaseData>
  technique: string
  caution: 'ombro' | 'joelho' | null
  cautionNote: string | null
}

export interface CalisteniaExercise {
  id: string
  name: string
  forPhase: PhaseId
  sets: number
  reps: string
  rest: string
  technique: string
  caution: 'ombro' | 'joelho' | null
  cautionNote: string | null
}

export interface CoreExercise {
  id: string
  name: string
  sets: number
  reps: string
  rest: string
  technique: string
}

export interface MetconData {
  format: string
  exercises: string[]
}

export interface CalisteniaSession {
  pushProgression: CalisteniaExercise[]
  pullProgression: CalisteniaExercise[]
  dipsProgression: CalisteniaExercise[]
  core: CoreExercise[]
  metcon: Record<PhaseId, MetconData>
}

export interface RunningSession {
  label: string
  detail: string
}

export interface RunningLevel {
  qualidade: RunningSession
  longa: RunningSession
}

export interface MobilityExercise {
  id: string
  name: string
  sets: number
  reps: string
  freq: string
  technique: string
}

export interface NutritionTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface MealItem {
  meal: string
  time: string
  items: string[]
}

export interface ShoppingCategory {
  category: string
  items: string[]
}

export interface Supplement {
  id: string
  name: string
  essential: boolean
  dose: string
  timing: string
  notes: string
  brand: string | null
}

export interface TestDefinition {
  id: string
  name: string
  unit: string
  lower: boolean
  initial: number | string
  target: number | string
  description: string
}

export interface PlanUiConfig {
  showJointPainCheckin?: boolean
  showStrengthPRs?: boolean
  showMovementVisualizer?: boolean
  simplifiedExerciseLog?: boolean
}

export interface Plan {
  meta: { version: string; source: string }
  ui?: PlanUiConfig
  profile: {
    name: string
    age: number
    height: number
    initialWeight: number
    startDate: string
    goals: Record<string, string | number>
    healthNotes: string[]
  }
  phases: Phase[]
  dailyTemplate: Record<string, WeekDayTemplate>
  exercises: {
    forcaA: Exercise[]
    forcaB: Exercise[]
    forcaC: Exercise[]
    calistenia: CalisteniaSession
  }
  running: { levels: Record<PhaseId, RunningLevel> }
  mobility: { shoulder: MobilityExercise[]; knee: MobilityExercise[] }
  nutrition: {
    dailyTargets: { trainingDay: NutritionTargets; restDay: NutritionTargets }
    mealPlan: MealItem[]
    tips: string[]
    shoppingList: ShoppingCategory[]
  }
  supplements: Supplement[]
  dailyRoutines: Record<string, { label: string; schedule: { time: string; activity: string }[] }>
  tests: TestDefinition[]
}

// Database types
export interface DailyLog {
  id?: number
  date: string // YYYY-MM-DD
  weightKg?: number
  sleepH?: number
  energy?: number // 1-5
  shoulderPain?: number // 0-3
  kneePain?: number // 0-3
  rpe?: number // 1-10
  notes?: string
  workoutDone?: boolean
  checkInDone?: boolean
  sessionType?: string
  sessionName?: string
  trainingLevel?: PhaseId
  lightVolume?: boolean
}

export interface TrainingSettings {
  startDate: string
  name: string
  height: number
  initialWeight: number
  goalWeight: number
  darkMode: boolean
  routineType: 'morning' | 'evening'
  performanceTargets: Record<string, string | number>
  trainingLevel: PhaseId
  lightVolume: boolean
  sessionDurationMin: number
  primaryGoal: TrainingGoal | null
  goalHistory: TrainingGoal[]
  customActivities: string[]
}

export interface ActivityLog {
  id: string
  date: string
  activity: string
  name: string
  durationMin?: number
  distanceKm?: number
  completed: boolean
}

export interface TrainingGoal {
  id: string
  title: string
  activity: string
  kind: 'minutes' | 'distance' | 'sessions' | 'runTime' | 'weight'
  target: number
  startDate: string
  endDate?: string
  distanceKm?: number
  baseline?: number
  archivedAt?: string
}

export interface RunningLog {
  id?: number
  date: string
  type: 'qualidade' | 'longa' | 'livre'
  distanceKm: number
  durationMin: number
  paceMinKm?: number
  hrAvg?: number
  effort?: number
  notes?: string
}

export interface StrengthSet {
  weightKg: number
  reps: number
}

export interface StrengthLog {
  id?: number
  date: string
  exercise: string
  sets: StrengthSet[]
  notes?: string
}

export interface AppSettings {
  id?: number
  key: string
  value: string
}

export interface ExerciseCheck {
  id?: number
  date: string
  exerciseId: string
  done: boolean
}

export interface Sale {
  id?: number
  monthKey: string // YYYY-MM
  date: string // YYYY-MM-DD
  customerName?: string
  email: string
  commissionMrr: number
  farolMrr?: number
  /** Campo legado, aceito apenas durante a migração dos dados existentes. */
  planAmount?: number
  setupAmount: number
  createdAt: string
  updatedAt: string
}

export interface CommissionTier {
  id: string
  upToPercent: number | null
  commissionPercent: number
}

export interface MonthlySalesConfig {
  monthKey: string // YYYY-MM
  goalAmount: number
  setupCommissionPercent: number
  weeklyBonusPercent: number
  tierMode?: 'fixed-company-bands'
  tiers: CommissionTier[]
  updatedAt: string
}

export interface TrainingDay {
  status: 'active'
  date: string
  dayOfWeek: number
  phase: PhaseId
  isDeload: boolean
  sessionType: string
  sessionLabel: string
  sessionIcon: string
}
