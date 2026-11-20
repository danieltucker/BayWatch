import { X } from 'lucide-react'
import { useFleet } from '../../context/FleetContext'

export default function Toasts() {
  const { toasts, dismissToast } = useFleet()
  if (!toasts.length) return null
  return (
    <div className="bw-toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="bw-toast">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--wt-warn-700)' }}>{t.title}</p>
            <p className="text-xs" style={{ color: 'var(--wt-warn-600)' }}>{t.body}</p>
          </div>
          <button type="button" className="bw-iconbtn bw-iconbtn--sm" aria-label="Dismiss"
            style={{ background: 'transparent', border: 0 }} onClick={() => dismissToast(t.id)}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
