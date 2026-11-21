import { useEffect, useId, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'

type Option = { value: string; label: string }

export default function AnalysisFilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`analysis-menu${open ? ' is-open' : ''}`} ref={rootRef}>
      <span className="analysis-menu-label" id={`${id}-label`}>{label}</span>
      <button
        type="button"
        className="analysis-menu-trigger"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen(current => !current)}
      >
        <span>{current?.label}</span>
        <CaretDown size={16} weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={`${id}-list`}
          className="analysis-menu-panel"
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {options.map(option => {
            const selected = option.value === value
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`analysis-menu-option${selected ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <span>{option.label}</span>
                  {selected ? <Check size={16} weight="bold" aria-hidden="true" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
