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
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-md border-t border-slate-100/60 dark:border-neutral-700/60 flex items-center justify-around shadow-nav"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="flex-1 min-w-0 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors duration-150"
        >
          {({ isActive }) =>
            isActive ? (
              <span className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl px-3 py-1 flex flex-col items-center gap-0.5 transition-all duration-150">
                <Icon size={22} strokeWidth={1.8} />
                <span className="text-[10px] font-medium leading-tight truncate max-w-[3rem]">{label}</span>
              </span>
            ) : (
              <>
                <Icon size={22} strokeWidth={1.8} className="text-slate-400 dark:text-slate-500" />
                <span className="text-[10px] font-medium leading-tight truncate max-w-[3rem] text-slate-400 dark:text-slate-500">{label}</span>
              </>
            )
          }
        </NavLink>
      ))}
    </nav>
  )
}
