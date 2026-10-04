interface Tab<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  id?: string
  tabs: Tab<T>[]
  active: T
  onChange: (id: T) => void
  ariaLabel: string
}

export default function SegmentTabs<T extends string>({ id, tabs, active, onChange, ariaLabel }: Props<T>) {
  return (
    <div className="tab-bar" role="tablist" aria-label={ariaLabel}>
      {tabs.map(tab => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={id ? `${id}-tab-${tab.id}` : undefined}
            aria-controls={id ? `${id}-panel` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={event => {
              const index = tabs.findIndex(item => item.id === tab.id)
              const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
              if (next == null) return
              event.preventDefault()
              onChange(tabs[next].id)
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
            }}
            onClick={() => onChange(tab.id)}
            className={`tab-bar-item ${selected ? 'tab-bar-item-active' : ''}`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
