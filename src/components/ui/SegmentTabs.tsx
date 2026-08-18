interface Tab<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  tabs: Tab<T>[]
  active: T
  onChange: (id: T) => void
  ariaLabel: string
}

export default function SegmentTabs<T extends string>({ tabs, active, onChange, ariaLabel }: Props<T>) {
  return (
    <div className="tab-bar" role="tablist" aria-label={ariaLabel}>
      {tabs.map(tab => {
        const selected = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
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
