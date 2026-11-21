import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  date?: { value: string; label: string }
  action?: ReactNode
}

export default function PageHeader({ eyebrow, title, description, date, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        {eyebrow && <p className="page-kicker mb-2">{eyebrow}</p>}
        {date && <time className="page-date" dateTime={date.value}>{date.label}</time>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {action && <div className="page-header-action shrink-0">{action}</div>}
    </header>
  )
}
