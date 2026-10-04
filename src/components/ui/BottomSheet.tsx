import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'

export default function BottomSheet({ title, description, onClose, children }: {
  title: string; description?: string; onClose: () => void; children: ReactNode
}) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const viewport = window.visualViewport
    const fitViewport = () => {
      const height = viewport?.height ?? window.innerHeight
      const keyboardOffset = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0))
      ref.current?.style.setProperty('--sheet-visible-height', `${height}px`)
      ref.current?.style.setProperty('--sheet-keyboard-offset', keyboardOffset > 80 ? `${keyboardOffset}px` : '0px')
    }
    fitViewport()
    viewport?.addEventListener('resize', fitViewport)
    viewport?.addEventListener('scroll', fitViewport)
    const focusable = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea,select,[tabindex="0"]') ?? [])].filter(element => element.getClientRects().length)
    focusable()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) { event.preventDefault(); return }
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      viewport?.removeEventListener('resize', fitViewport)
      viewport?.removeEventListener('scroll', fitViewport)
      previousFocus?.focus()
    }
  }, [])
  return createPortal(
    <div className="journey-sheet-root">
      <button className="sheet-overlay" aria-label="Fechar painel" onClick={onClose} />
      <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="sheet-panel journey-sheet animate-slide-up">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 id={titleId} className="text-[26px] font-bold leading-tight tracking-tight">{title}</h2>{description && <p className="mt-2 text-[14px] leading-5 text-ink-muted">{description}</p>}</div>
          <button className="btn-icon shrink-0" onClick={onClose} aria-label="Fechar"><X size={22} weight="bold" /></button>
        </div>
        {children}
      </section>
    </div>,
    document.getElementById('training-overlays')!,
  )
}
