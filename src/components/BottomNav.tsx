import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  CaretDoubleLeft,
  CaretDoubleRight,
  ChartLineUp,
  House,
  Leaf,
  PlusCircle,
  UserCircle,
} from '@phosphor-icons/react'

const tabs = [
  { to: '/', icon: House, label: 'Início' },
  { to: '/historico', icon: ChartLineUp, label: 'Análise' },
  { to: '/registrar', icon: PlusCircle, label: 'Registrar' },
  { to: '/ajustes', icon: UserCircle, label: 'Perfil' },
]

export default function BottomNav({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { pathname } = useLocation()
  const [allowExpandReveal, setAllowExpandReveal] = useState(true)

  useEffect(() => {
    if (!collapsed) setAllowExpandReveal(true)
  }, [collapsed])

  const handleToggle = () => {
    if (!collapsed) {
      setAllowExpandReveal(false)
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    }
    onToggleCollapse?.()
  }

  return (
    <nav
      className={`training-nav${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Navegação principal"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div
        className="training-nav-header"
        onMouseLeave={() => {
          if (collapsed) setAllowExpandReveal(true)
        }}
      >
        <div className="training-nav-brand">
          <span className="training-nav-mark" aria-hidden="true">
            <Leaf size={22} weight="fill" />
          </span>
          <span className="training-nav-brand-copy">
            <span className="training-nav-brand-name">Meu ritmo</span>
            <span className="brand-caption">Um de cada vez</span>
          </span>
        </div>

        {onToggleCollapse && (
          <>
            <button
              type="button"
              className="training-nav-collapse is-minimize"
              onClick={handleToggle}
              tabIndex={collapsed ? -1 : 0}
              aria-hidden={collapsed}
              aria-label="Recolher menu"
              title="Recolher menu"
            >
              <CaretDoubleLeft size={16} weight="bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`training-nav-collapse is-expand${allowExpandReveal ? ' is-revealable' : ''}`}
              onClick={handleToggle}
              tabIndex={collapsed && allowExpandReveal ? 0 : -1}
              aria-hidden={!collapsed}
              aria-label="Expandir menu"
              title="Expandir menu"
            >
              <CaretDoubleRight size={16} weight="bold" aria-hidden="true" />
            </button>
          </>
        )}
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
              title={collapsed ? label : undefined}
            >
              <span className="nav-icon">
                <Icon size={20} weight={active ? 'fill' : 'regular'} />
              </span>
              <span className="nav-label">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
