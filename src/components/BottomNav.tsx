import { NavLink, useLocation } from 'react-router-dom'
import {
  ChartLineUp,
  House,
  Leaf,
  Moon,
  PlusCircle,
  Sun,
  Target,
  UserCircle,
} from '@phosphor-icons/react'
import { useSettings } from '@/hooks/useSettings'
import { BODY_GOALS_PATH } from '@/lib/bodyGoals'

const tabs = [
  { to: '/', icon: House, label: 'Início' },
  { to: '/historico', icon: ChartLineUp, label: 'Análise' },
  { to: '/registrar', icon: PlusCircle, label: 'Registrar' },
  { to: BODY_GOALS_PATH, icon: Target, label: 'Metas' },
  { to: '/ajustes', icon: UserCircle, label: 'Perfil' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const { settings, updateSetting } = useSettings()
  const dark = settings.darkMode
  const lightLabel = dark ? 'Usar iluminação clara' : 'Usar iluminação escura'

  return (
    <nav
      className="training-nav is-collapsed"
      aria-label="Navegação principal"
      data-collapsed="true"
    >
      <div className="training-nav-header">
        <div className="training-nav-brand">
          <span className="training-nav-mark" aria-hidden="true">
            <Leaf size={22} weight="regular" />
          </span>
          <span className="training-nav-brand-copy">
            <span className="training-nav-brand-name">Meu ritmo</span>
            <span className="brand-caption">Um de cada vez</span>
          </span>
        </div>
      </div>

      <div className="training-nav-inner">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to === '/ajustes' && ['/fichas', '/guias', '/rotinas'].includes(pathname))
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={`training-nav-item${active ? ' nav-active' : ''}`}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              title={label}
            >
              <span className="nav-icon" aria-hidden="true">
                <Icon size={22} weight="regular" />
              </span>
              <span className="nav-label">{label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className="training-nav-item training-nav-light"
          aria-pressed={dark}
          aria-label={lightLabel}
          title={lightLabel}
          onClick={() => { void updateSetting('darkMode', !dark) }}
        >
          <span className="nav-icon" aria-hidden="true">
            {dark ? <Moon size={22} weight="regular" /> : <Sun size={22} weight="regular" />}
          </span>
          <span className="nav-label">Iluminação</span>
        </button>
      </div>
    </nav>
  )
}
