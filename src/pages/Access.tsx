import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Key,
  LockKeyOpen,
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
    <main className="relative min-h-[100dvh] overflow-hidden bg-canvas px-4 py-6 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border border-accent/15" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-8 -top-16 h-52 w-52 rounded-full border border-accent/10" aria-hidden="true" />

      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-5xl overflow-hidden rounded-[30px] border border-line bg-surface shadow-[0_34px_90px_-50px_rgba(20,49,37,0.55)] md:min-h-[42rem] md:grid-cols-[0.92fr_1.08fr]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-ink p-7 text-canvas sm:p-10 md:p-12">
          <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full border border-white/10" aria-hidden="true" />

          <div className="relative">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-white/10 text-primary-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <ShieldCheck size={25} weight="duotone" />
            </span>
            <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-200">Treino pessoal</p>
            <h1 className="mt-3 max-w-[12ch] text-[2.4rem] font-semibold leading-[0.98] tracking-[-0.05em] text-white sm:text-[3rem]">
              Seu plano começa no perfil certo.
            </h1>
            <p className="mt-5 max-w-[34ch] text-[15px] leading-6 text-white/62">
              Cada acesso abre um plano, histórico e conjunto de preferências independentes neste dispositivo.
            </p>
          </div>

          <div className="relative mt-12 border-t border-white/10 pt-5">
            <p className="flex items-start gap-2.5 text-[12px] leading-5 text-white/55">
              <LockKeyOpen size={17} weight="duotone" className="mt-0.5 shrink-0 text-primary-200" />
              Acesso local simples, sem e-mail. O código identifica qual conta deve ser aberta.
            </p>
          </div>
        </section>

        <section className="flex items-center p-6 sm:p-10 md:p-14">
          <div className="w-full max-w-md">
            <span className="icon-tile mb-6 h-12 w-12 rounded-[16px]" aria-hidden="true">
              <Key size={23} weight="duotone" />
            </span>
            <p className="page-kicker">Acesso ao aplicativo</p>
            <h2 className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.04em] text-ink">Digite sua senha</h2>
            <p className="mt-3 max-w-[38ch] text-[14px] leading-6 text-ink-muted">
              Não é necessário informar e-mail. Use o código de cinco caracteres recebido para sua conta.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="access-code" className="label">Senha de acesso</label>
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
                {submitting ? 'Validando acesso' : 'Entrar no meu plano'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}
