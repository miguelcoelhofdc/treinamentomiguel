import { NavLink, useLocation } from 'react-router-dom'
import { ChartLineUp, House, Leaf, PlusCircle, UserCircle } from '@phosphor-icons/react'

const tabs = [
  { to: '/', icon: House, label: 'Início' },
  { to: '/historico', icon: ChartLineUp, label: 'Análise' },
  { to: '/registrar', icon: PlusCircle, label: 'Registrar' },
  { to: '/ajustes', icon: UserCircle, label: 'Perfil' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  return (
    <nav className="training-nav" aria-label="Navegação principal">
      <div className="training-nav-brand">
        <span><Leaf size={29} weight="fill" /></span>
        Meu ritmo
        <span className="brand-caption">Um registro de cada vez</span>
      </div>
      <div className="training-nav-inner">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to === '/ajustes' && ['/fichas', '/guias', '/rotinas'].includes(pathname))
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={`training-nav-item ${active ? 'nav-active' : ''}`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <span className="nav-icon">
                <Icon size={22} weight={active ? 'fill' : 'regular'} />
              </span>
              <span className="nav-label">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
