import { NavLink } from 'react-router-dom'
import {
  Barbell,
  BookOpenText,
  CalendarDots,
  ChartLineUp,
  GearSix,
  type Icon,
} from '@phosphor-icons/react'

interface TabItem {
  to: string
  icon: Icon
  label: string
  primary?: boolean
}

const tabs: TabItem[] = [
  { to: '/plano', icon: CalendarDots, label: 'Plano' },
  { to: '/progresso', icon: ChartLineUp, label: 'Progresso' },
  { to: '/', icon: Barbell, label: 'Hoje', primary: true },
  { to: '/guias', icon: BookOpenText, label: 'Guias' },
  { to: '/ajustes', icon: GearSix, label: 'Ajustes' },
]

export default function BottomNav() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 px-3"
      style={{ zIndex: 20, paddingBottom: 'calc(0.65rem + var(--safe-bottom))' }}
    >
      <nav
        aria-label="Navegação principal"
        className="pointer-events-auto mx-auto grid max-w-[31rem] grid-cols-5 items-end rounded-[22px] border border-white/70 bg-surface/92 px-1.5 pb-1.5 pt-2 shadow-nav backdrop-blur-xl dark:border-white/10"
      >
        {tabs.map(({ to, icon: Icon, label, primary }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className="group flex min-h-[54px] min-w-0 flex-col items-center justify-end gap-1 rounded-[16px] px-1 pb-1 text-ink-muted transition duration-200 active:scale-[0.96]"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center transition duration-200 ${
                    primary
                      ? `-mt-5 h-12 w-12 rounded-[17px] border-[3px] border-canvas shadow-[0_12px_24px_-14px_rgba(35,73,56,0.9)] ${isActive ? 'bg-accent text-white' : 'bg-ink text-canvas'}`
                      : `h-7 w-10 rounded-xl ${isActive ? 'bg-accent-soft text-accent-strong' : 'group-hover:text-ink-soft'}`
                  }`}
                >
                  <Icon size={primary ? 23 : 21} weight={isActive ? 'fill' : 'regular'} />
                </span>
                <span className={`truncate text-[11px] font-semibold leading-none ${isActive ? 'text-accent-strong' : 'text-ink-muted'}`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
