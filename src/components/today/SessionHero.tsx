import { CheckCircle } from '@phosphor-icons/react'
import ProgressRing from '@/components/ui/ProgressRing'
import SessionIcon from '@/components/ui/SessionIcon'
import type { TrainingDay } from '@/types'

interface Props {
  training: TrainingDay
  workoutDone: boolean
  doneExercises: number
  totalExercises: number
  sessionProgress: number
  hasJointCautions: boolean
}

export default function SessionHero({
  training,
  workoutDone,
  doneExercises,
  totalExercises,
  sessionProgress,
  hasJointCautions,
}: Props) {
  return (
    <section className="hero-surface p-5 sm:p-6" aria-labelledby="session-title">
      <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border border-white/10" aria-hidden="true" />
      <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-primary-200">
          <span className="status-dot bg-primary-300" />
          <span className="text-[11px] font-bold uppercase tracking-[0.15em]">Sessão do dia</span>
        </div>
        {training.isDeload && <span className="badge bg-white/10 text-primary-100">Volume leve</span>}
      </div>

      <div className="relative mt-7 flex items-end justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-white/10 text-primary-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <SessionIcon type={training.sessionType} size={25} weight="duotone" />
          </div>
          <h2 id="session-title" className="max-w-[14rem] text-[27px] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
            {training.sessionLabel}
          </h2>
          <p className="mt-2 text-[13px] font-medium text-white/60">
            {workoutDone
              ? 'Sessão concluída'
              : totalExercises > 0
                ? `${doneExercises} de ${totalExercises} movimentos`
                : 'Pronto quando você estiver'}
          </p>
        </div>
        <ProgressRing
          value={sessionProgress}
          size={78}
          stroke={7}
          inverse
          label={workoutDone ? 'feito' : totalExercises > 0 ? `${doneExercises}/${totalExercises}` : 'hoje'}
        />
      </div>

      {workoutDone && (
        <div className="relative mt-5 flex items-center gap-2 rounded-[15px] border border-white/10 bg-white/10 px-3.5 py-3 text-[13px] font-semibold text-primary-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <CheckCircle size={19} weight="fill" /> Feito. Mais um dia entregue.
        </div>
      )}

      <p className="relative mt-4 border-t border-white/10 pt-3 text-[11px] leading-5 text-white/45">
        {hasJointCautions
          ? 'Respeite os avisos de cada exercício. Interrompa se sentir dor aguda ou mal-estar.'
          : 'Interrompa se sentir dor aguda, tontura ou falta de ar fora do esperado.'}
        {' '}
        <span className="text-white/35">O app não substitui acompanhamento profissional.</span>
      </p>
    </section>
  )
}
