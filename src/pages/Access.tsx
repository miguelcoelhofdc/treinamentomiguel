import { useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ShieldCheck,
  SpinnerGap,
} from '@phosphor-icons/react'
import { authenticateAccessCode, storeProfileId } from '@/lib/auth'

const PIN_LENGTH = 4

export default function Access() {
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const unlock = async (code: string) => {
    if (submittingRef.current) return
    if (!/^\d{4}$/.test(code)) {
      setError('Digite os 4 dígitos da senha.')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setError('')

    try {
      const profileId = await authenticateAccessCode(code)
      if (!profileId) {
        setError('Senha incorreta. Tente novamente.')
        setAccessCode('')
        return
      }

      storeProfileId(profileId)
      window.location.assign('/')
    } catch {
      setError('Não foi possível validar o acesso neste navegador.')
      setAccessCode('')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void unlock(accessCode)
  }

  return (
    <main className="training-theme tracking-theme app-theme training-access">
      <div className="access-form">
        <span className="icon-tile mb-6" aria-hidden="true"><ShieldCheck size={28} /></span>
        <p className="page-kicker">Rotinas de saúde</p>
        <h1 className="page-title mt-2">Seu acompanhamento começa aqui</h1>
        <p className="page-subtitle mt-3">Digite sua senha de 4 dígitos para abrir seus registros.</p>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="access-code" className="label">Senha</label>
            <input
              id="access-code"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoFocus
              maxLength={PIN_LENGTH}
              placeholder="••••"
              className="input h-14 px-4 text-center text-[28px] tracking-[0.45em] tabular-nums"
              value={accessCode}
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'access-error' : 'access-helper'}
              onChange={event => {
                const value = event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
                setAccessCode(value)
                if (error) setError('')
                if (value.length === PIN_LENGTH) void unlock(value)
              }}
            />
            <p id="access-helper" className="helper">Quatro números. A entrada acontece ao completar.</p>
            {error && (
              <p id="access-error" role="alert" className="mt-2 text-[13px] font-semibold leading-5 text-red-600 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting || accessCode.length !== PIN_LENGTH}>
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
