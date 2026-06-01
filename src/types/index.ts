export type PhaseId = 'base' | 'desenvolvimento' | 'performance'

export interface Phase {
  id: PhaseId
  name: string
  startWeek: number
  endWeek: number
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

export interface RunningWeek {
  week: number
  thursday: RunningSession
  sunday: RunningSession
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

export interface Plan {
  meta: { version: string; source: string }
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
  weekTemplate: Record<string, WeekDayTemplate>
  deloadWeeks: number[]
  exercises: {
    forcaA: Exercise[]
    forcaB: Exercise[]
    forcaC: Exercise[]
    calistenia: CalisteniaSession
  }
  running: { weeks: RunningWeek[] }
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

export interface TrainingDay {
  status: 'notStarted' | 'active' | 'completed'
  date: string
  dayOfWeek: number
  weekNumber: number
  phase: PhaseId
  isDeload: boolean
  sessionType: string
  sessionLabel: string
  sessionIcon: string
}
