import { ArrowClockwise, Barbell, CheckCircle, Heart, PersonSimpleRun, WarningCircle } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

export function ActivityBadge({ activity }: { activity: string }) {
  const Icon = activity === 'corrida' ? PersonSimpleRun : ['forca', 'calistenia'].includes(activity) ? Barbell : Heart
  return <span className={`activity-badge badge-${activity === 'corrida' ? 'run' : ['forca', 'calistenia'].includes(activity) ? 'strength' : 'other'}`} aria-hidden="true"><Icon size={25} weight="duotone" /></span>
}

export function TrackingLoading() {
  return <div className="tracking-loading" aria-label="Carregando seus registros" aria-busy="true"><div className="skeleton h-24" /><div className="skeleton h-72" /><div className="skeleton h-24" /></div>
}

export function TrackingError({ retry }: { retry: () => void }) {
  return <div className="tracking-empty" role="alert"><WarningCircle size={34} /><h2>Não foi possível abrir seus registros</h2><p>Tente carregar novamente para continuar.</p><button className="btn-secondary" onClick={retry}><ArrowClockwise size={18} />Tentar novamente</button></div>
}

export function EmptyBlock({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="tracking-empty"><span className="empty-mark" aria-hidden="true"><Barbell size={28} weight="duotone" /></span><h2>{title}</h2><p>{children}</p>{action}</div>
}

export function SavedNotice({ children }: { children: ReactNode }) {
  return <div className="saved-notice" role="status"><CheckCircle size={25} weight="fill" /><span>{children}</span></div>
}
