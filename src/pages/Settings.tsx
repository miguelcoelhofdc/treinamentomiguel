import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  CalendarDots,
  CheckCircle,
  Clock,
  Database,
  DownloadSimple,
  FloppyDisk,
  MoonStars,
  Palette,
  ShieldCheck,
  SpinnerGap,
  Sun,
  Trash,
  UploadSimple,
  UserCircle,
  Warning,
  type Icon,
} from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import { db } from '@/db'
import { localDateKey } from '@/lib/date'
import type {
  AppSettings,
  DailyLog,
  ExerciseCheck,
  RunningLog,
  StrengthLog,
} from '@/types'

type SettingsData = {
  startDate: string
  name: string
  height: number
  initialWeight: number
  goalWeight: number
  darkMode: boolean
  routineType: 'morning' | 'evening'
}

interface Props {
  settings: SettingsData
  updateSetting: <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K],
  ) => void | Promise<void>
}

interface BackupPayload {
  kind?: string
  schemaVersion?: number
  exportedAt?: string
  daily: DailyLog[]
  running: RunningLog[]
  strength: StrengthLog[]
  settings: AppSettings[]
  exerciseChecks: ExerciseCheck[]
}

type Feedback = { message: string; type: 'success' | 'error' }
type BusyAction = 'profile' | 'preference' | 'export' | 'import' | 'reset' | null
type ProfileDraft = {
  name: string
  height: string
  initialWeight: string
  goalWeight: string
}
type ProfileField = keyof ProfileDraft

const BACKUP_FIELDS = ['daily', 'running', 'strength', 'settings', 'exerciseChecks'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOptionalNumber(value: unknown): boolean {
  return value == null || (typeof value === 'number' && Number.isFinite(value))
}

function isDailyLog(value: unknown): value is DailyLog {
  if (!isRecord(value) || typeof value.date !== 'string') return false
  return ['weightKg', 'sleepH', 'energy', 'shoulderPain', 'kneePain', 'rpe'].every(key =>
    isOptionalNumber(value[key]),
  ) && (value.notes == null || typeof value.notes === 'string')
    && (value.workoutDone == null || typeof value.workoutDone === 'boolean')
}

function isRunningLog(value: unknown): value is RunningLog {
  if (!isRecord(value)) return false
  return typeof value.date === 'string'
    && ['qualidade', 'longa', 'livre'].includes(String(value.type))
    && typeof value.distanceKm === 'number'
    && Number.isFinite(value.distanceKm)
    && typeof value.durationMin === 'number'
    && Number.isFinite(value.durationMin)
    && isOptionalNumber(value.paceMinKm)
    && isOptionalNumber(value.hrAvg)
    && isOptionalNumber(value.effort)
    && (value.notes == null || typeof value.notes === 'string')
}

function isStrengthLog(value: unknown): value is StrengthLog {
  if (!isRecord(value) || typeof value.date !== 'string' || typeof value.exercise !== 'string') return false
  if (!Array.isArray(value.sets)) return false
  return value.sets.every(set => isRecord(set)
    && typeof set.weightKg === 'number'
    && Number.isFinite(set.weightKg)
    && typeof set.reps === 'number'
    && Number.isFinite(set.reps))
    && (value.notes == null || typeof value.notes === 'string')
}

function isAppSetting(value: unknown): value is AppSettings {
  return isRecord(value) && typeof value.key === 'string' && typeof value.value === 'string'
}

function isExerciseCheck(value: unknown): value is ExerciseCheck {
  return isRecord(value)
    && typeof value.date === 'string'
    && typeof value.exerciseId === 'string'
    && typeof value.done === 'boolean'
}

function parseBackup(raw: string): BackupPayload {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) throw new Error('Formato de backup inválido.')

  const hasBackupData = BACKUP_FIELDS.some(field => field in parsed)
  if (!hasBackupData) throw new Error('O arquivo não contém dados reconhecidos.')

  for (const field of BACKUP_FIELDS) {
    if (parsed[field] != null && !Array.isArray(parsed[field])) {
      throw new Error(`A seção ${field} do backup é inválida.`)
    }
  }

  const payload: BackupPayload = {
    kind: typeof parsed.kind === 'string' ? parsed.kind : undefined,
    schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : undefined,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : undefined,
    daily: (parsed.daily ?? []) as DailyLog[],
    running: (parsed.running ?? []) as RunningLog[],
    strength: (parsed.strength ?? []) as StrengthLog[],
    settings: (parsed.settings ?? []) as AppSettings[],
    exerciseChecks: (parsed.exerciseChecks ?? []) as ExerciseCheck[],
  }

  if (!payload.daily.every(isDailyLog)
    || !payload.running.every(isRunningLog)
    || !payload.strength.every(isStrengthLog)
    || !payload.settings.every(isAppSetting)
    || !payload.exerciseChecks.every(isExerciseCheck)) {
    throw new Error('Há registros corrompidos ou incompatíveis no backup.')
  }

  return payload
}

function stripId<T extends { id?: number }>(record: T): T {
  const clean = { ...record }
  delete clean.id
  return clean
}

function recordCount(payload: BackupPayload): number {
  return payload.daily.length
    + payload.running.length
    + payload.strength.length
    + payload.settings.length
    + payload.exerciseChecks.length
}

function SettingsSection({
  icon: SectionIcon,
  title,
  description,
  children,
}: {
  icon: Icon
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3 px-1">
        <span className="icon-tile mt-0.5" aria-hidden="true">
          <SectionIcon size={21} weight="bold" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
          <p className="mt-1 text-[13px] leading-5 text-ink-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function Settings({ settings, updateSetting }: Props) {
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    name: settings.name,
    height: String(settings.height),
    initialWeight: String(settings.initialWeight),
    goalWeight: String(settings.goalWeight),
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({})
  const [confirmReset, setConfirmReset] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const feedbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    setProfileDraft({
      name: settings.name,
      height: String(settings.height),
      initialWeight: String(settings.initialWeight),
      goalWeight: String(settings.goalWeight),
    })
  }, [settings.name, settings.height, settings.initialWeight, settings.goalWeight])

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
  }, [])

  const showFeedback = (message: string, type: Feedback['type'] = 'success') => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
    setFeedback({ message, type })
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 4200)
  }

  const commitSetting = async <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    await Promise.resolve(updateSetting(key, value))
  }

  const setProfileValue = (field: ProfileField, value: string) => {
    setProfileDraft(current => ({ ...current, [field]: value }))
    setFieldErrors(current => ({ ...current, [field]: undefined }))
  }

  const profileChanged = profileDraft.name.trim() !== settings.name
    || Number(profileDraft.height) !== settings.height
    || Number(profileDraft.initialWeight) !== settings.initialWeight
    || Number(profileDraft.goalWeight) !== settings.goalWeight

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: Partial<Record<ProfileField, string>> = {}
    const name = profileDraft.name.trim()
    const height = Number(profileDraft.height)
    const initialWeight = Number(profileDraft.initialWeight)
    const goalWeight = Number(profileDraft.goalWeight)

    if (!name) nextErrors.name = 'Informe como você quer ser chamado.'
    if (!Number.isFinite(height) || height < 100 || height > 250) {
      nextErrors.height = 'Use uma altura entre 100 e 250 cm.'
    }
    if (!Number.isFinite(initialWeight) || initialWeight < 30 || initialWeight > 300) {
      nextErrors.initialWeight = 'Use um peso entre 30 e 300 kg.'
    }
    if (!Number.isFinite(goalWeight) || goalWeight < 30 || goalWeight > 300) {
      nextErrors.goalWeight = 'Use uma meta entre 30 e 300 kg.'
    }

    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      showFeedback('Revise os campos destacados antes de salvar.', 'error')
      return
    }

    setBusy('profile')
    try {
      await Promise.all([
        commitSetting('name', name),
        commitSetting('height', height),
        commitSetting('initialWeight', initialWeight),
        commitSetting('goalWeight', goalWeight),
      ])
      showFeedback('Perfil e metas atualizados.')
    } catch {
      showFeedback('Não foi possível salvar o perfil. Tente novamente.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handlePreference = async <K extends 'startDate' | 'routineType' | 'darkMode'>(
    key: K,
    value: SettingsData[K],
    successMessage: string,
  ) => {
    setBusy('preference')
    try {
      await commitSetting(key, value)
      showFeedback(successMessage)
    } catch {
      showFeedback('Não foi possível salvar esta preferência.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleExport = async () => {
    setBusy('export')
    try {
      const [daily, running, strength, storedSettings, exerciseChecks] = await Promise.all([
        db.dailyLogs.toArray(),
        db.runningLogs.toArray(),
        db.strengthLogs.toArray(),
        db.settings.toArray(),
        db.exerciseChecks.toArray(),
      ])
      const payload: BackupPayload = {
        kind: 'treino-miguel-backup',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        daily,
        running,
        strength,
        settings: storedSettings,
        exerciseChecks,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `treino-backup-${localDateKey()}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      showFeedback(`Backup criado com ${recordCount(payload)} registros.`)
    } catch {
      showFeedback('Não foi possível criar o backup.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const applyImportedSettings = async (rows: AppSettings[]) => {
    const imported = new Map(rows.map(row => [row.key, row.value]))
    const name = imported.get('name')
    const startDate = imported.get('startDate')
    const height = Number(imported.get('height'))
    const initialWeight = Number(imported.get('initialWeight'))
    const goalWeight = Number(imported.get('goalWeight'))
    const routineType = imported.get('routineType')
    const darkMode = imported.get('darkMode')

    if (name) await commitSetting('name', name)
    if (startDate) await commitSetting('startDate', startDate)
    if (Number.isFinite(height)) await commitSetting('height', height)
    if (Number.isFinite(initialWeight)) await commitSetting('initialWeight', initialWeight)
    if (Number.isFinite(goalWeight)) await commitSetting('goalWeight', goalWeight)
    if (routineType === 'morning' || routineType === 'evening') {
      await commitSetting('routineType', routineType)
    }
    if (darkMode === 'true' || darkMode === 'false') {
      await commitSetting('darkMode', darkMode === 'true')
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    setBusy('import')
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo muito grande.')
      const payload = parseBackup(await file.text())

      await db.transaction(
        'rw',
        [db.dailyLogs, db.runningLogs, db.strengthLogs, db.settings, db.exerciseChecks],
        async () => {
          for (const importedLog of payload.daily) {
            const log = stripId(importedLog)
            const existing = await db.dailyLogs.where('date').equals(log.date).toArray()
            const primary = existing[0]
            if (primary?.id != null) await db.dailyLogs.update(primary.id, log)
            else await db.dailyLogs.add(log)

            const duplicateIds = existing.slice(1)
              .map(item => item.id)
              .filter((id): id is number => id != null)
            if (duplicateIds.length > 0) await db.dailyLogs.bulkDelete(duplicateIds)
          }

          for (const importedLog of payload.running) {
            const log = stripId(importedLog)
            const existing = (await db.runningLogs.where('date').equals(log.date).toArray())
              .filter(item => item.type === log.type
                && item.distanceKm === log.distanceKm
                && Math.abs(item.durationMin - log.durationMin) < 0.000_001)
            const primary = existing[0]
            if (primary?.id != null) await db.runningLogs.update(primary.id, log)
            else await db.runningLogs.add(log)

            const duplicateIds = existing.slice(1)
              .map(item => item.id)
              .filter((id): id is number => id != null)
            if (duplicateIds.length > 0) await db.runningLogs.bulkDelete(duplicateIds)
          }

          for (const importedLog of payload.strength) {
            const log = stripId(importedLog)
            const existing = (await db.strengthLogs.where('date').equals(log.date).toArray())
              .filter(item => item.exercise === log.exercise)
            const primary = existing[0]
            if (primary?.id != null) await db.strengthLogs.update(primary.id, log)
            else await db.strengthLogs.add(log)

            const duplicateIds = existing.slice(1)
              .map(item => item.id)
              .filter((id): id is number => id != null)
            if (duplicateIds.length > 0) await db.strengthLogs.bulkDelete(duplicateIds)
          }

          for (const importedSetting of payload.settings) {
            const setting = stripId(importedSetting)
            const existing = await db.settings.where('key').equals(setting.key).toArray()
            const primary = existing[0]
            if (primary?.id != null) await db.settings.update(primary.id, setting)
            else await db.settings.add(setting)

            const duplicateIds = existing.slice(1)
              .map(item => item.id)
              .filter((id): id is number => id != null)
            if (duplicateIds.length > 0) await db.settings.bulkDelete(duplicateIds)
          }

          for (const importedCheck of payload.exerciseChecks) {
            const check = stripId(importedCheck)
            const existing = await db.exerciseChecks
              .where('[date+exerciseId]')
              .equals([check.date, check.exerciseId])
              .toArray()
            const primary = existing[0]
            if (primary?.id != null) await db.exerciseChecks.update(primary.id, check)
            else await db.exerciseChecks.add(check)

            const duplicateIds = existing.slice(1)
              .map(item => item.id)
              .filter((id): id is number => id != null)
            if (duplicateIds.length > 0) await db.exerciseChecks.bulkDelete(duplicateIds)
          }
        },
      )

      await applyImportedSettings(payload.settings)
      showFeedback(`Backup restaurado: ${recordCount(payload)} registros processados.`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Arquivo inválido.'
      showFeedback(`Não foi possível importar. ${detail}`, 'error')
    } finally {
      input.value = ''
      setBusy(null)
    }
  }

  const handleReset = async () => {
    setBusy('reset')
    try {
      await db.transaction(
        'rw',
        [db.dailyLogs, db.runningLogs, db.strengthLogs, db.exerciseChecks],
        async () => {
          await Promise.all([
            db.dailyLogs.clear(),
            db.runningLogs.clear(),
            db.strengthLogs.clear(),
            db.exerciseChecks.clear(),
          ])
        },
      )
      setConfirmReset(false)
      showFeedback('Histórico apagado. Seu perfil e suas preferências foram preservados.')
    } catch {
      showFeedback('Não foi possível apagar o histórico.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page-content page-enter space-y-8">
      <PageHeader
        eyebrow="Preferências"
        title="Ajustes"
        description="Personalize seu plano e mantenha seus dados sob controle."
      />

      <div aria-live="polite" aria-atomic="true">
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 text-[14px] font-semibold leading-5 ${
              feedback.type === 'success'
                ? 'border-accent/20 bg-accent-soft/65 text-accent-strong'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-300'
            }`}
          >
            {feedback.type === 'success'
              ? <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0" />
              : <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      <SettingsSection
        icon={UserCircle}
        title="Perfil e metas"
        description="Esses dados calibram seus indicadores de progresso."
      >
        <form className="list-surface divide-y divide-line/80" onSubmit={handleProfileSubmit} noValidate>
          <div className="p-4 sm:p-5">
            <label className="label" htmlFor="settings-name">Como quer ser chamado</label>
            <input
              id="settings-name"
              type="text"
              autoComplete="name"
              className="input"
              value={profileDraft.name}
              onChange={event => setProfileValue('name', event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'settings-name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="settings-name-error" className="mt-2 text-[12px] font-medium text-red-600 dark:text-red-300">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 divide-y divide-line/80 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="p-4 sm:p-5">
              <label className="label" htmlFor="settings-height">Altura</label>
              <div className="relative">
                <input
                  id="settings-height"
                  type="number"
                  inputMode="numeric"
                  min="100"
                  max="250"
                  className="input pr-12 tabular-nums"
                  value={profileDraft.height}
                  onChange={event => setProfileValue('height', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.height)}
                  aria-describedby={fieldErrors.height ? 'settings-height-error' : 'settings-height-helper'}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-semibold text-ink-muted">cm</span>
              </div>
              <p id="settings-height-helper" className="helper">Usada como referência corporal.</p>
              {fieldErrors.height && (
                <p id="settings-height-error" className="mt-2 text-[12px] font-medium text-red-600 dark:text-red-300">
                  {fieldErrors.height}
                </p>
              )}
            </div>

            <div className="p-4 sm:p-5">
              <label className="label" htmlFor="settings-initial-weight">Peso inicial</label>
              <div className="relative">
                <input
                  id="settings-initial-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="30"
                  max="300"
                  className="input pr-12 tabular-nums"
                  value={profileDraft.initialWeight}
                  onChange={event => setProfileValue('initialWeight', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.initialWeight)}
                  aria-describedby={fieldErrors.initialWeight ? 'settings-initial-weight-error' : undefined}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-semibold text-ink-muted">kg</span>
              </div>
              {fieldErrors.initialWeight && (
                <p id="settings-initial-weight-error" className="mt-2 text-[12px] font-medium text-red-600 dark:text-red-300">
                  {fieldErrors.initialWeight}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
            <div>
              <label className="label" htmlFor="settings-goal-weight">Meta de peso</label>
              <div className="relative">
                <input
                  id="settings-goal-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="30"
                  max="300"
                  className="input pr-12 tabular-nums"
                  value={profileDraft.goalWeight}
                  onChange={event => setProfileValue('goalWeight', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.goalWeight)}
                  aria-describedby={fieldErrors.goalWeight ? 'settings-goal-weight-error' : 'settings-goal-weight-helper'}
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-semibold text-ink-muted">kg</span>
              </div>
              <p id="settings-goal-weight-helper" className="helper">A linha de meta em Progresso usa este valor.</p>
              {fieldErrors.goalWeight && (
                <p id="settings-goal-weight-error" className="mt-2 text-[12px] font-medium text-red-600 dark:text-red-300">
                  {fieldErrors.goalWeight}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto"
              disabled={!profileChanged || busy !== null}
            >
              {busy === 'profile'
                ? <SpinnerGap size={19} weight="bold" className="animate-spin" />
                : <FloppyDisk size={19} weight="bold" />}
              Salvar perfil
            </button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        icon={CalendarDots}
        title="Plano e rotina"
        description="Defina quando o ciclo começa e em qual período você costuma treinar."
      >
        <div className="list-surface divide-y divide-line/80">
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_13rem] sm:items-center sm:p-5">
            <div className="flex items-start gap-3">
              <CalendarDots size={21} weight="duotone" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <label className="text-[15px] font-semibold text-ink" htmlFor="settings-start-date">Início do ciclo</label>
                <p className="mt-1 text-[12px] leading-4 text-ink-muted">Alterar esta data recalcula as 26 semanas do plano.</p>
              </div>
            </div>
            <input
              id="settings-start-date"
              type="date"
              className="input tabular-nums"
              value={settings.startDate}
              disabled={busy !== null}
              onChange={event => void handlePreference('startDate', event.target.value, 'Data do ciclo atualizada.')}
            />
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <Clock size={21} weight="duotone" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-[15px] font-semibold text-ink">Período preferido</p>
                <p className="mt-1 text-[12px] leading-4 text-ink-muted">O guia de rotina abre direto no período escolhido.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-[17px] bg-surface-raised p-1.5" role="group" aria-label="Período preferido de treino">
              <button
                type="button"
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[13px] px-3 text-[14px] font-semibold transition duration-200 active:scale-[0.985] ${
                  settings.routineType === 'morning'
                    ? 'bg-surface text-accent-strong shadow-card'
                    : 'text-ink-muted'
                }`}
                aria-pressed={settings.routineType === 'morning'}
                disabled={busy !== null}
                onClick={() => void handlePreference('routineType', 'morning', 'Rotina da manhã selecionada.')}
              >
                <Sun size={18} weight="bold" />
                Manhã
              </button>
              <button
                type="button"
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[13px] px-3 text-[14px] font-semibold transition duration-200 active:scale-[0.985] ${
                  settings.routineType === 'evening'
                    ? 'bg-surface text-accent-strong shadow-card'
                    : 'text-ink-muted'
                }`}
                aria-pressed={settings.routineType === 'evening'}
                disabled={busy !== null}
                onClick={() => void handlePreference('routineType', 'evening', 'Rotina da noite selecionada.')}
              >
                <MoonStars size={18} weight="bold" />
                Noite
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Palette}
        title="Aparência"
        description="Escolha o contraste mais confortável para acompanhar seus treinos."
      >
        <div className="list-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-raised text-accent-strong" aria-hidden="true">
                {settings.darkMode
                  ? <MoonStars size={22} weight="duotone" />
                  : <Sun size={22} weight="duotone" />}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink">Tema escuro</p>
                <p className="mt-1 text-[12px] leading-4 text-ink-muted">
                  {settings.darkMode ? 'Ativo para reduzir o brilho da tela.' : 'Desativado; usando superfícies claras.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.darkMode}
              aria-label={settings.darkMode ? 'Desativar tema escuro' : 'Ativar tema escuro'}
              disabled={busy !== null}
              onClick={() => void handlePreference(
                'darkMode',
                !settings.darkMode,
                settings.darkMode ? 'Tema claro ativado.' : 'Tema escuro ativado.',
              )}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-200 active:scale-[0.97] ${
                settings.darkMode ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  settings.darkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Database}
        title="Seus dados"
        description="Crie uma cópia portátil ou restaure o histórico neste aparelho."
      >
        <div className="list-surface divide-y divide-line/80">
          <div className="flex items-start gap-3 bg-accent-soft/35 p-4 sm:p-5">
            <ShieldCheck size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent-strong" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-ink">Backup completo</p>
              <p className="mt-1 text-[12px] leading-5 text-ink-muted">
                Inclui perfil, preferências, check-ins, corridas, força e marcações de exercícios.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="btn-secondary w-full"
              disabled={busy !== null}
            >
              {busy === 'export'
                ? <SpinnerGap size={19} weight="bold" className="animate-spin" />
                : <DownloadSimple size={19} weight="bold" />}
              Exportar backup
            </button>
            <label
              className={`btn-secondary w-full cursor-pointer ${busy !== null ? 'pointer-events-none opacity-50' : ''}`}
              aria-disabled={busy !== null}
            >
              {busy === 'import'
                ? <SpinnerGap size={19} weight="bold" className="animate-spin" />
                : <UploadSimple size={19} weight="bold" />}
              Importar backup
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                disabled={busy !== null}
                onChange={handleImport}
              />
            </label>
          </div>
        </div>
      </SettingsSection>

      <section className="space-y-3">
        <div className="flex items-start gap-3 px-1">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300" aria-hidden="true">
            <Warning size={21} weight="bold" />
          </span>
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">Zona de cuidado</h2>
            <p className="mt-1 text-[13px] leading-5 text-ink-muted">Ações permanentes ficam isoladas para evitar toques acidentais.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[22px] border border-red-200/80 bg-surface dark:border-red-950">
          {!confirmReset ? (
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-[15px] font-semibold text-ink">Apagar histórico</p>
                <p className="mt-1 max-w-[46ch] text-[12px] leading-5 text-ink-muted">
                  Remove treinos, corridas e check-ins. Perfil, meta e aparência serão preservados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-[14px] border border-red-200 px-4 py-2 text-[14px] font-semibold text-red-600 transition duration-200 hover:bg-red-50 active:translate-y-px active:scale-[0.985] dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30 sm:w-auto"
                disabled={busy !== null}
              >
                <Trash size={18} weight="bold" />
                Apagar histórico
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-4 sm:p-5" role="alert" aria-describedby="reset-warning">
              <div className="flex items-start gap-3">
                <Warning size={22} weight="fill" className="mt-0.5 shrink-0 text-red-600 dark:text-red-300" aria-hidden="true" />
                <div>
                  <p className="text-[15px] font-semibold text-ink">Confirmar exclusão?</p>
                  <p id="reset-warning" className="mt-1 text-[13px] leading-5 text-ink-muted">
                    Esta ação não pode ser desfeita. Exporte um backup antes se quiser guardar o histórico.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void handleReset()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[15px] bg-red-600 px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:bg-red-700 active:translate-y-px active:scale-[0.985] disabled:opacity-50"
                  disabled={busy !== null}
                >
                  {busy === 'reset'
                    ? <SpinnerGap size={19} weight="bold" className="animate-spin" />
                    : <Trash size={19} weight="bold" />}
                  Apagar definitivamente
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="btn-secondary"
                  disabled={busy !== null}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
