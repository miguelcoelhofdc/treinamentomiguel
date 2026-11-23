import { useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ShieldCheck,
  SpinnerGap,
} from '@phosphor-icons/react'
import { ACCESS_PROFILES, getStoredProfileId, storeProfileId, type ProfileId } from '@/lib/auth'
import { signInTraining, TrainingCloudError } from '@/lib/trainingAccess'

export default function Access() {
  const [profile, setProfile] = useState<ProfileId>(getStoredProfileId() ?? 'miguel')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const unlock = async () => {
    if (submittingRef.current || !password) return

    submittingRef.current = true
    setSubmitting(true)
    setError('')

    try {
      const result = await signInTraining(profile, password)
      storeProfileId(result.profile)
      window.location.assign('/')
    } catch (cause) {
      if (cause instanceof TrainingCloudError && cause.status === 401) {
        setError('Senha incorreta para este perfil.')
        setPassword('')
      } else {
        setError('Não foi possível conectar à nuvem. Tente novamente em instantes.')
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void unlock()
  }

  return (
    <main className="training-theme tracking-theme app-theme training-access">
      <div className="access-form">
        <span className="icon-tile mb-6" aria-hidden="true"><ShieldCheck size={28} /></span>
        <p className="page-kicker">Rotinas de saúde</p>
        <h1 className="page-title mt-2">Seu acompanhamento começa aqui</h1>
        <p className="page-subtitle mt-3">Entre para acessar seus registros em qualquer aparelho.</p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="access-profile" className="label">Perfil</label>
            <select
              id="access-profile"
              className="input h-12"
              autoComplete="username"
              value={profile}
              disabled={submitting}
              onChange={event => { setProfile(event.target.value as ProfileId); setError('') }}
            >
              {Object.values(ACCESS_PROFILES).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="access-password" className="label">Senha</label>
            <input
              id="access-password"
              type="password"
              autoComplete="current-password"
              maxLength={256}
              className="input h-12"
              value={password}
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'access-error' : undefined}
              onChange={event => {
                setPassword(event.target.value)
                if (error) setError('')
              }}
            />
            {error && (
              <p id="access-error" role="alert" className="mt-2 text-[13px] font-semibold leading-5 text-red-600 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting || !password}>
            {submitting
              ? <SpinnerGap size={20} weight="bold" className="animate-spin" />
              : <ArrowRight size={20} weight="bold" />}
            {submitting ? 'Validando acesso' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
