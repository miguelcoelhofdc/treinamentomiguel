import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ShieldCheck,
  SpinnerGap,
} from '@phosphor-icons/react'
import { authenticateAccessCode, storeProfileId } from '@/lib/auth'

export default function Access() {
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    if (!/^\d{2}-\d{2}$/.test(accessCode.trim())) {
      setError('Digite o código no formato 00-00.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const profileId = await authenticateAccessCode(accessCode)
      if (!profileId) {
        setError('Código não reconhecido. Confira os números e tente novamente.')
        return
      }

      storeProfileId(profileId)
      window.location.assign('/')
    } catch {
      setError('Não foi possível validar o acesso neste navegador.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="training-theme training-access">
      <div className="access-form">
        <span className="icon-tile mb-6" aria-hidden="true"><ShieldCheck size={28} /></span>
        <p className="page-kicker">Treino e bem-estar</p>
        <h1 className="page-title mt-2">Seu próximo passo começa aqui</h1>
        <p className="page-subtitle mt-3">Entre com o código recebido para abrir seu plano pessoal.</p>
            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="access-code" className="label">Código de acesso</label>
                <input
                  id="access-code"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  maxLength={5}
                  placeholder="00-00"
                  className="input h-14 px-4 text-[19px] tracking-[0.18em] tabular-nums"
                  value={accessCode}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'access-error' : 'access-helper'}
                  onChange={event => {
                    const value = event.target.value.replace(/[^\d-]/g, '').slice(0, 5)
                    setAccessCode(value)
                    if (error) setError('')
                  }}
                />
                <p id="access-helper" className="helper">Inclua o hífen entre os dois pares de números.</p>
                {error && (
                  <p id="access-error" role="alert" className="mt-2 text-[13px] font-semibold leading-5 text-red-600 dark:text-red-300">
                    {error}
                  </p>
                )}
              </div>

              <button type="submit" className="btn-primary w-full" disabled={submitting || accessCode.length !== 5}>
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
