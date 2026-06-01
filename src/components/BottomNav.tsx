import { NavLink } from 'react-router-dom'
import { CalendarCheck, CalendarDays, TrendingUp, BookOpen, Settings } from 'lucide-react'

const tabs = [
  { to: '/',         icon: CalendarCheck, label: 'Hoje'      },
  { to: '/plano',    icon: CalendarDays,  label: 'Plano'     },
  { to: '/progresso',icon: TrendingUp,    label: 'Progresso' },
  { to: '/guias',    icon: BookOpen,      label: 'Guias'     },
  { to: '/ajustes',  icon: Settings,      label: 'Ajustes'   },
]

export default function BottomNav() {
  return (
    <nav className="tab-bar">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `tab-item ${isActive ? 'active' : ''}`}>
          <Icon size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
