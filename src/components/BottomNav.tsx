import { NavLink } from 'react-router-dom'
import { CalendarCheck, CalendarDays, TrendingUp, BookOpen, Settings } from 'lucide-react'

const tabs = [
  { to: '/',          icon: CalendarCheck, label: 'Hoje'      },
  { to: '/plano',     icon: CalendarDays,  label: 'Plano'     },
  { to: '/progresso', icon: TrendingUp,    label: 'Progresso' },
  { to: '/guias',     icon: BookOpen,      label: 'Guias'     },
  { to: '/ajustes',   icon: Settings,      label: 'Ajustes'   },
]

export default function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/92 dark:bg-neutral-800/92 backdrop-blur-xl border-t border-slate-200/70 dark:border-neutral-700 flex items-center justify-around shadow-[0_-8px_24px_rgba(15,23,42,0.07)]"
      style={{ paddingBottom: 'calc(0.4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          aria-label={label}
          className="flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors duration-150"
        >
          {({ isActive }) =>
            isActive ? (
              <span className="text-primary-600 dark:text-primary-400 flex flex-col items-center gap-0.5 transition-all duration-150">
                <span className="rounded-xl bg-primary-50 dark:bg-primary-900/30 px-3 py-1">
                  <Icon size={21} strokeWidth={2.2} />
                </span>
                <span className="text-[10px] font-semibold leading-tight">{label}</span>
              </span>
            ) : (
              <>
                <Icon size={21} strokeWidth={1.8} className="text-slate-400 dark:text-slate-500" />
                <span className="text-[10px] font-medium leading-tight text-slate-400 dark:text-slate-500">{label}</span>
              </>
            )
          }
        </NavLink>
      ))}
    </nav>
  )
}
