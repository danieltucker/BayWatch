import { X } from 'lucide-react'
import { WIDGET_DEFS } from './WidgetBar'

export default function WidgetPickerModal({ activeIds, onAdd, onClose }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
          style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--wt-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>Add Widget</p>
            <button onClick={onClose}
              className="p-1 rounded transition-colors text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(WIDGET_DEFS).map(([id, def]) => {
              const Icon = def.icon
              const active = activeIds.includes(id)
              return (
                <button
                  key={id}
                  onClick={() => { if (!active) { onAdd(id); onClose() } }}
                  disabled={active}
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
                  style={active
                    ? { borderColor: 'var(--wt-border)', background: 'var(--wt-surface-2)', opacity: 0.4, cursor: 'not-allowed' }
                    : { borderColor: 'var(--wt-border)', background: 'var(--wt-surface)', cursor: 'pointer' }
                  }
                  onMouseEnter={active ? undefined : e => {
                    e.currentTarget.style.borderColor = 'var(--wt-brand-400)'
                    e.currentTarget.style.background = 'color-mix(in oklch, var(--wt-brand-50) 60%, var(--wt-surface))'
                  }}
                  onMouseLeave={active ? undefined : e => {
                    e.currentTarget.style.borderColor = 'var(--wt-border)'
                    e.currentTarget.style.background = 'var(--wt-surface)'
                  }}
                >
                  <Icon size={16} style={{ color: active ? 'var(--wt-text-faint)' : def.colorVar }} />
                  <span className="text-xs font-medium leading-tight" style={{ color: 'var(--wt-text)' }}>{def.label}</span>
                  {active && <span className="wt-eyebrow ml-auto">Added</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
