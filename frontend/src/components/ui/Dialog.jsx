import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog. Renders as a centred card on desktop and a bottom sheet on the
 * small-viewport layout. Handles Escape, focus trap, focus restore and scroll lock.
 */
export default function Dialog({ label, title, subtitle, onClose, sheet = true, width, children, footer }) {
  const ref = useRef(null)

  useEffect(() => {
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const el = ref.current
    const first = el?.querySelector('[data-autofocus]') || el?.querySelector(FOCUSABLE)
    first?.focus()

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.() }
      if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null)
        if (!items.length) return
        const [a, z] = [items[0], items[items.length - 1]]
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className={`bw-scrim ${sheet ? 'bw-scrim--sheet' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label || title} className="bw-dialog" style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="bw-grabber" aria-hidden="true" />
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && <h2 className="bw-h2">{title}</h2>}
              {subtitle && <p className="bw-sub mt-0.5">{subtitle}</p>}
            </div>
            <button type="button" className="bw-iconbtn" onClick={onClose} aria-label="Close">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  )
}
