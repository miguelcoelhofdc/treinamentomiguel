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
    <section className="list-surface">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left transition duration-200 hover:bg-surface-raised/70 active:translate-y-px sm:px-5"
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
        <div id={contentId} role="region" className="reveal-item border-t border-line/80 px-4 pb-5 pt-4 sm:px-5">
          {children}
        </div>
      )}
    </section>
  )
}
