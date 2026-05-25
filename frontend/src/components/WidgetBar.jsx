import { useState, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, horizontalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import {
  HardDrive, CheckCircle2, XCircle, Thermometer, Flame, Clock,
  Database, LayoutGrid, Activity, AlertTriangle, Cpu, ShieldAlert, Plus, X,
} from 'lucide-react'
import WidgetPickerModal from './WidgetPickerModal'
import WidgetDetailModal, { WIDGET_HAS_DETAIL } from './WidgetDetailModal'
import { getAppConfig, saveAppConfig } from '../api/client'

// ── Widget definitions ─────────────────────────────────────────────────────

export const WIDGET_DEFS = {
  total_drives: {
    label: 'Total Drives',
    icon: HardDrive,
    color: 'text-slate-600 dark:text-gray-300',
    getValue: (drives) => ({ value: drives.length }),
  },
  healthy: {
    label: 'Healthy',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    getValue: (drives) => ({ value: drives.filter(d => d.smart_status === 'PASSED').length }),
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    color: 'text-red-500 dark:text-red-400',
    getValue: (drives) => ({ value: drives.filter(d => d.smart_status === 'FAILED').length }),
  },
  avg_temp: {
    label: 'Avg Temp',
    icon: Thermometer,
    color: 'text-sky-500 dark:text-sky-400',
    getValue: (drives) => {
      const temps = drives.map(d => d.temperature_c).filter(t => t != null)
      const avg = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null
      return { value: avg != null ? `${avg}°C` : '—' }
    },
  },
  hottest_drive: {
    label: 'Hottest Drive',
    icon: Flame,
    color: 'text-orange-500 dark:text-orange-400',
    getValue: (drives) => {
      const w = drives.filter(d => d.temperature_c != null)
      if (!w.length) return { value: '—' }
      const hot = w.reduce((a, b) => b.temperature_c > a.temperature_c ? b : a)
      return { value: `${hot.temperature_c}°C`, sub: hot.model || hot.serial }
    },
  },
  oldest_drive: {
    label: 'Oldest Drive',
    icon: Clock,
    color: 'text-purple-500 dark:text-purple-400',
    getValue: (drives) => {
      const w = drives.filter(d => d.power_on_hours != null)
      if (!w.length) return { value: '—' }
      const old = w.reduce((a, b) => b.power_on_hours > a.power_on_hours ? b : a)
      return { value: `${(old.power_on_hours / 24 / 365).toFixed(1)}y`, sub: old.model || old.serial }
    },
  },
  total_capacity: {
    label: 'Total Capacity',
    icon: Database,
    color: 'text-blue-500 dark:text-blue-400',
    getValue: (drives) => {
      const total = drives.reduce((s, d) => s + (d.capacity_bytes || 0), 0)
      if (!total) return { value: '—' }
      const tb = total / 1e12
      return { value: tb >= 1 ? `${tb.toFixed(1)} TB` : `${(total / 1e9).toFixed(0)} GB` }
    },
  },
  assigned_bays: {
    label: 'Assigned Bays',
    icon: LayoutGrid,
    color: 'text-cyan-500 dark:text-cyan-400',
    getValue: (drives, profiles, baysMap) => {
      const all = Object.values(baysMap).flat()
      const n = all.filter(b => b.drive_serial).length
      return { value: `${n}/${all.length}` }
    },
  },
  health_pct: {
    label: 'Drive Health',
    icon: Activity,
    color: 'text-emerald-500 dark:text-emerald-400',
    getValue: (drives) => {
      if (!drives.length) return { value: '—' }
      const pct = Math.round(drives.filter(d => d.smart_status === 'PASSED').length / drives.length * 100)
      return { value: `${pct}%` }
    },
  },
  reallocated: {
    label: 'Reallocated',
    icon: AlertTriangle,
    color: 'text-amber-500 dark:text-amber-400',
    getValue: (drives) => {
      const total = drives.reduce((s, d) => s + (d.reallocated_sectors || 0), 0)
      return { value: total, sub: 'sectors total' }
    },
  },
  ssd_count: {
    label: 'SSDs',
    icon: Cpu,
    color: 'text-violet-500 dark:text-violet-400',
    getValue: (drives) => ({ value: drives.filter(d => d.rpm === 0).length }),
  },
  hdd_count: {
    label: 'HDDs',
    icon: HardDrive,
    color: 'text-slate-500 dark:text-gray-400',
    getValue: (drives) => ({ value: drives.filter(d => d.rpm > 0).length }),
  },
  warranty_warnings: {
    label: 'Warranty',
    icon: ShieldAlert,
    color: 'text-amber-500 dark:text-amber-400',
    getValue: (drives, profiles) => {
      const n = profiles.filter(p => p.warranty_days_remaining != null && p.warranty_days_remaining <= 90).length
      return { value: n, sub: 'expiring soon' }
    },
  },
}

export const DEFAULT_WIDGET_IDS = ['total_drives', 'healthy', 'avg_temp', 'warranty_warnings']

const STORAGE_KEY = 'widget-config'

function loadWidgetIds() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const ids = JSON.parse(saved)
      if (Array.isArray(ids) && ids.every(id => WIDGET_DEFS[id])) return ids
    }
  } catch {}
  return [...DEFAULT_WIDGET_IDS]
}

// ── Sortable widget card ───────────────────────────────────────────────────

function SortableWidgetCard({ id, drives, profiles, baysMap, onRemove, onOpenDetail }) {
  const def = WIDGET_DEFS[id]
  const { value } = def.getValue(drives, profiles, baysMap)
  const hasDetail = WIDGET_HAS_DETAIL.has(id)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  const Icon = def.icon

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (hasDetail && !isDragging) onOpenDetail(id) }}
      className={`group relative flex items-center gap-3 rounded-xl bg-white dark:bg-gray-900/70 border border-slate-200 dark:border-gray-800/60 px-4 h-[72px] shrink-0 select-none ${hasDetail ? 'cursor-pointer hover:border-blue-400/60 dark:hover:border-blue-600/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className={`shrink-0 ${def.color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-gray-500 leading-none mb-0.5">{def.label}</p>
        <p className={`text-lg font-bold leading-none ${def.color}`}>{value}</p>
      </div>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onRemove(id) }}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-400 hover:bg-red-500 hover:text-white transition-colors items-center justify-center hidden group-hover:flex"
      >
        <X size={10} />
      </button>
    </div>
  )
}

// ── Widget bar ─────────────────────────────────────────────────────────────

export default function WidgetBar({ drives, profiles, baysMap }) {
  const [widgetIds, setWidgetIds] = useState(loadWidgetIds)  // localStorage for fast initial render
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailWidget, setDetailWidget] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // Override with backend data on mount — backend is cross-browser source of truth
  useEffect(() => {
    getAppConfig('widgets').then(data => {
      const ids = JSON.parse(data.value)
      if (Array.isArray(ids) && ids.every(id => WIDGET_DEFS[id])) {
        setWidgetIds(ids)
        localStorage.setItem(STORAGE_KEY, data.value)
      }
    }).catch(() => {})
  }, [])

  function save(ids) {
    setWidgetIds(ids)
    const json = JSON.stringify(ids)
    localStorage.setItem(STORAGE_KEY, json)
    saveAppConfig('widgets', json).catch(() => {})
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      save(arrayMove(widgetIds, widgetIds.indexOf(active.id), widgetIds.indexOf(over.id)))
    }
  }

  function removeWidget(id) {
    save(widgetIds.filter(w => w !== id))
  }

  function addWidget(id) {
    if (!widgetIds.includes(id)) save([...widgetIds, id])
  }

  if (!drives.length) return null

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetIds} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 dark:border-gray-800/60 overflow-x-auto">
            {widgetIds.map(id => (
              <SortableWidgetCard
                key={id}
                id={id}
                drives={drives}
                profiles={profiles}
                baysMap={baysMap}
                onRemove={removeWidget}
                onOpenDetail={setDetailWidget}
              />
            ))}

            {/* Plus button — same shape as widget cards */}
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-gray-700/60 bg-transparent hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 px-4 py-3 shrink-0 transition-colors text-slate-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <Plus size={16} />
              <span className="text-xs font-medium">Add</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>

      {pickerOpen && (
        <WidgetPickerModal
          activeIds={widgetIds}
          onAdd={addWidget}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {detailWidget && (
        <WidgetDetailModal
          widgetId={detailWidget}
          drives={drives}
          profiles={profiles}
          onClose={() => setDetailWidget(null)}
        />
      )}
    </>
  )
}
