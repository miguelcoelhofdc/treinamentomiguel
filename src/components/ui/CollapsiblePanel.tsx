import { useState, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'

interface Props {
  id: string
  title: string
  description?: string
  icon?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export default function CollapsiblePanel({
  id,
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = `${id}-content`

  return (
    <section className="list-surface disclosure">
      <button
        type="button"
        aria-label={title}
        onClick={() => setOpen(value => !value)}
        className="disclosure-trigger flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        aria-controls={contentId}
      >
        {icon && <span className="icon-tile" aria-hidden="true">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-5 text-ink">{title}</span>
          {description && (
            <span className="mt-0.5 block text-[12px] leading-4 text-ink-muted">{description}</span>
          )}
        </span>
        <CaretDown
          size={18}
          weight="bold"
          className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={contentId} role="region" aria-label={title} className="disclosure-body reveal-item">
          {children}
        </div>
      )}
    </section>
  )
}
