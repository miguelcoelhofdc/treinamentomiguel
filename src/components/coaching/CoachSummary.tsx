import { Link } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import { coachingAdherence, objectiveTitle } from '@/lib/coaching'
import { goalProgress } from '@/lib/continuousTraining'
import { useCoaching } from '@/hooks/useCoaching'
import { useJourney } from '@/hooks/useJourney'
import type { TrainingSettings } from '@/types'

export default function CoachSummary({ settings }: { settings: TrainingSettings }) {
  const { sessions, loaded, error, retry } = useCoaching()
  const journey = useJourney(settings.startDate)
  if (!settings.coaching) return null
  const stats = coachingAdherence(sessions, journey.today, settings.coaching.startDate)
  const result = settings.primaryGoal ? goalProgress(settings.primaryGoal, journey.activities, journey.logs, journey.today) : null
  return <section className="coach-summary" aria-label="Acompanhamento do plano">
    <div className="flex items-start justify-between gap-4"><div><p className="page-kicker">Seu objetivo</p><h2 className="mt-1 text-[20px] font-semibold">{objectiveTitle(settings.coaching.objective)}</h2></div><Link to="/coaching" className="inline-link">Ajustar<ArrowRight size={16} /></Link></div>
    {error ? <p role="alert" className="mt-4">Não foi possível abrir o planejamento. <button className="btn-ghost" onClick={retry}>Tentar novamente</button></p> : <div className="coach-summary-metrics"><div><strong>{loaded ? stats.completed : '—'}</strong><span>treinos realizados</span></div><div><strong>{loaded && stats.percent != null ? stats.percent + '%' : '—'}</strong><span>adesão ao plano</span></div></div>}
    <p className="helper">{stats.due ? stats.completed + ' de ' + stats.due + ' sessões previstas até agora.' : 'Sua adesão aparece após a primeira sessão ou ao fim do dia planejado.'} Atividades extras continuam no histórico.</p>
    {settings.coaching.objective === 'muscle' && <p className="helper mt-2">Veja cargas e repetições na Evolução. Peso corporal não mede massa muscular.</p>}
    {result && (result.achieved || result.expired) && <div className="coach-review mt-5"><p>{result.achieved ? 'Você alcançou sua meta. Vamos revisar o próximo passo?' : 'O prazo da sua meta terminou. Revise o objetivo ou continue no seu ritmo.'}</p><Link to="/coaching" className="btn-secondary mt-3">Revisar meu objetivo</Link></div>}
  </section>
}
