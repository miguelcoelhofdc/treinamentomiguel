import { NavLink, useLocation } from 'react-router-dom'
import { Barbell, BookOpenText, ChartLineUp, Path, UserCircle } from '@phosphor-icons/react'

const tabs = [
  { to: '/', icon: Path, label: 'Jornada' },
  { to: '/hoje', icon: Barbell, label: 'Treino' },
  { to: '/progresso', icon: ChartLineUp, label: 'Evolução' },
  { to: '/guias', icon: BookOpenText, label: 'Guias' },
  { to: '/ajustes', icon: UserCircle, label: 'Perfil' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  return <nav className="training-nav" aria-label="Navegação principal">
    <div className="training-nav-inner">{tabs.map(({ to, icon: Icon, label }) => {
      const active = pathname === to || to === '/' && pathname === '/plano'
      return <NavLink key={to} to={to} end={to === '/'} className={`training-nav-item ${active ? 'nav-active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined}>
        <span className="nav-icon"><Icon size={25} weight={active ? 'fill' : 'regular'} /></span><span>{label}</span>
      </NavLink>
    })}</div>
  </nav>
}
