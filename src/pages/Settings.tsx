import { Link } from 'react-router-dom'
import {
  createContext,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  CaretDown,
  CalendarDots,
  CheckCircle,
  Database,
  DownloadSimple,
  FloppyDisk,
  MoonStars,
  Palette,
  ShieldCheck,
  SignOut,
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
import type { ProfileId } from '@/lib/auth'
import { localDateKey } from '@/lib/date'
import { isDateKey } from '@/lib/date'
import plan from '@/data/activePlan'
import { type UpdateTrainingSetting } from '@/lib/trainingSettings'
import type { TrainingSettings } from '@/types'
import { createTrainingBackup, restoreTrainingBackup } from '@/db/trainingBackup'
import { backupRecordCount, parseTrainingBackup } from '@/lib/trainingBackup'

type SettingsData = TrainingSettings

interface Props {
  settings: SettingsData
  updateSetting: UpdateTrainingSetting
  profileId: ProfileId
  profileLabel: string
  onLogout: () => void
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

const GROUPS = ['Dados pessoais', 'Fichas e consultas', 'Aparência', 'Conta', 'Dados e backup']
const SettingsGroupContext = createContext<{ active: string | null; select: (title: string | null) => void }>({ active: null, select: () => {} })

function SettingsSection({ icon: SectionIcon, title, description, children }: { icon: Icon; title: string; description: string; children: ReactNode }) {
  const { active, select } = useContext(SettingsGroupContext)
  const id = useId()
  const open = active === title
  return <section className={'settings-group ' + (open ? 'settings-group-active' : '')}>
    <button className="settings-group-trigger" aria-expanded={open} aria-controls={id} onClick={() => select(open && !window.matchMedia('(min-width: 1024px)').matches ? null : title)}>
      <SectionIcon size={22} className="shrink-0 text-ink-muted" />
      <span className="flex-1 min-w-0"><span className="block text-[20px] font-semibold">{title}</span><span className="block mt-1 text-[13px] leading-5 text-ink-muted">{description}</span></span>
      <CaretDown size={18} className={open ? 'rotate-180' : ''} />
    </button>
    <div id={id} className="settings-group-body" hidden={!open}>{children}</div>
  </section>
}

export default function Settings({ settings, updateSetting, profileId, profileLabel, onLogout }: Props) {
  const [activeGroup, setActiveGroup] = useState<string | null>(GROUPS[0])
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
      showFeedback('Perfil atualizado.')
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
    if (key === 'startDate' && typeof value === 'string' && !isDateKey(value)) {
      showFeedback('Escolha uma data válida para o início do acompanhamento.', 'error')
      return
    }
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
      const payload = await createTrainingBackup(profileId)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `treino-${profileId}-backup-${localDateKey()}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      showFeedback(`Backup criado com ${backupRecordCount(payload)} registros.`)
    } catch {
      showFeedback('Não foi possível criar o backup.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    setBusy('import')
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo muito grande.')
      const payload = parseTrainingBackup(await file.text(), plan)
      await restoreTrainingBackup(payload, profileId)
      showFeedback(`Backup restaurado: ${backupRecordCount(payload)} registros processados.`)
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
        [db.dailyLogs, db.runningLogs, db.strengthLogs, db.exerciseChecks, db.activityLogs, db.plannedSessions],
        async () => {
          await Promise.all([
            db.dailyLogs.clear(),
            db.runningLogs.clear(),
            db.strengthLogs.clear(),
            db.exerciseChecks.clear(),
            db.activityLogs.clear(),
            db.plannedSessions.clear(),
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
    <div className="page-content page-enter">
      <PageHeader
        eyebrow="Preferências"
        title="Perfil"
        description="Seus dados, suas preferências."
      />

      <div className="settings-profile-summary"><span className="settings-avatar" aria-hidden="true">{settings.name.trim()[0] ?? 'P'}</span><div className="min-w-0 flex-1"><p className="text-[16px] font-medium">{settings.name}</p><p className="helper">Perfil de {profileLabel}</p></div><Link to="/fichas" className="inline-link">Minhas fichas</Link></div>
      <div aria-live="polite" aria-atomic="true">
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-3 rounded-[18px] border px-4 py-3.5 text-[14px] font-semibold leading-5 ${
              feedback.type === 'success'
                ? 'border-success/25 bg-success-light text-success-dark dark:border-success/40 dark:bg-success/15 dark:text-success'
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

      <SettingsGroupContext.Provider value={{ active: activeGroup, select: setActiveGroup }}>
      <div className="settings-layout"><nav className="settings-group-nav" aria-label="Grupos de preferências">{GROUPS.map(group => <button key={group} aria-current={activeGroup === group ? 'true' : undefined} onClick={() => setActiveGroup(group)}>{group}</button>)}</nav><div className="min-w-0">
      <SettingsSection
        icon={UserCircle}
        title="Dados pessoais"
        description="As referências pessoais do seu acompanhamento."
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

      <SettingsSection icon={CalendarDots} title="Fichas e consultas" description="Seus exercícios salvos e materiais para consultar quando precisar.">
        <div className="profile-resource-links">
          <Link to="/fichas" className="btn-secondary">Minhas fichas de treino</Link>
          <Link to="/guias" className="btn-secondary">Guias e materiais de consulta</Link>
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
        icon={UserCircle}
        title="Conta"
        description="Troque de pessoa sem misturar os dados armazenados."
      >
        <div className="list-surface p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent-soft text-accent-strong" aria-hidden="true">
                <UserCircle size={23} weight="duotone" />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink">Perfil de {profileLabel}</p>
                <p className="mt-1 text-[12px] leading-4 text-ink-muted">Plano, histórico e backups exclusivos desta conta.</p>
              </div>
            </div>
            <button type="button" onClick={onLogout} className="btn-secondary w-full shrink-0 sm:w-auto" disabled={busy !== null}>
              <SignOut size={18} weight="bold" />
              Trocar acesso
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Database}
        title="Dados e backup"
        description="Crie uma cópia portátil ou restaure o histórico neste aparelho."
      >
        <div className="list-surface divide-y divide-line/80">
          <div className="flex items-start gap-3 bg-accent-soft/35 p-4 sm:p-5">
            <ShieldCheck size={22} weight="duotone" className="mt-0.5 shrink-0 text-accent-strong" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-ink">Backup completo</p>
              <p className="mt-1 text-[12px] leading-5 text-ink-muted">
                Inclui perfil, metas, atividades, preferências, check-ins, corridas, força e marcações de exercícios.
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
              role="button"
              tabIndex={busy !== null ? -1 : 0}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click() } }}
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

      <section className="space-y-3 mt-8" hidden={activeGroup !== "Dados e backup"}>
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
      </div></div>
      </SettingsGroupContext.Provider>
    </div>
  )
}
