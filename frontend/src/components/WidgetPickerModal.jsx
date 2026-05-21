import { X } from 'lucide-react'
import { WIDGET_DEFS, DEFAULT_WIDGET_IDS } from './WidgetBar'

export default function WidgetPickerModal({ activeIds, onAdd, onClose }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Add Widget</p>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 p-1 rounded transition-colors">
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
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-slate-100 dark:border-gray-800/40 bg-slate-50 dark:bg-gray-900/20 opacity-40 cursor-not-allowed'
                      : 'border-slate-200 dark:border-gray-700/60 bg-white dark:bg-gray-900/50 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-slate-400 dark:text-gray-600' : def.color} />
                  <span className="text-xs font-medium text-slate-700 dark:text-gray-200 leading-tight">{def.label}</span>
                  {active && <span className="ml-auto text-[9px] text-slate-400 dark:text-gray-600 font-medium">ADDED</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
