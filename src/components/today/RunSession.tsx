import { useState } from 'react'
import { PersonSimpleRun, X } from '@phosphor-icons/react'
import RunningLogForm from '@/components/RunningLogForm'

interface RunSessionData {
  label: string
  detail: string
}

interface Props {
  runSession: RunSessionData
  todayStr: string
  sessionType: string
  workoutDone: boolean
  onComplete: () => void
}

export default function RunSession({ runSession, todayStr, sessionType, workoutDone, onComplete }: Props) {
  const [showRunLog, setShowRunLog] = useState(false)

  return (
    <section className="space-y-3" aria-labelledby="run-title">
      <div className="section-heading">
        <div>
          <h2 id="run-title">Roteiro da corrida</h2>
          <p>{runSession.label}</p>
        </div>
        <PersonSimpleRun size={24} weight="duotone" className="text-accent-strong" />
      </div>
      <div className="surface p-5">
        <p className="text-[15px] leading-6 text-ink-soft">{runSession.detail}</p>
        {!workoutDone && !showRunLog && (
          <button type="button" onClick={() => setShowRunLog(true)} className="btn-primary mt-5 w-full">
            Registrar resultado
          </button>
        )}
        {showRunLog && (
          <div className="reveal-item">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <p className="text-[14px] font-semibold text-ink">Resultado da sessão</p>
              <button type="button" onClick={() => setShowRunLog(false)} className="btn-icon" aria-label="Fechar registro">
                <X size={18} />
              </button>
            </div>
            <RunningLogForm
              defaultDate={todayStr}
              defaultType={sessionType === 'qualidade' ? 'qualidade' : 'longa'}
              onSaved={() => { setShowRunLog(false); onComplete() }}
            />
          </div>
        )}
      </div>
    </section>
  )
}
