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
  WifiOff, Bug, Layers,
} from 'lucide-react'
import WidgetPickerModal from './WidgetPickerModal'
import WidgetDetailModal, { WIDGET_HAS_DETAIL } from './WidgetDetailModal'
import { getAppConfig, saveAppConfig } from '../api/client'

// ── Widget definitions ─────────────────────────────────────────────────────

export const WIDGET_DEFS = {
  total_drives: {
    label: 'Total Drives',
    icon: HardDrive,
    colorVar: 'var(--wt-text-muted)',
    getValue: (drives) => ({ value: drives.length }),
  },
  healthy: {
    label: 'Healthy',
    icon: CheckCircle2,
    colorVar: 'var(--wt-up-600)',
    getValue: (drives) => ({ value: drives.filter(d => d.smart_status === 'PASSED').length }),
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    colorVar: 'var(--wt-down-500)',
    getValue: (drives) => ({ value: drives.filter(d => d.smart_status === 'FAILED').length }),
  },
  avg_temp: {
    label: 'Avg Temp',
    icon: Thermometer,
    colorVar: 'var(--wt-teal-500)',
    getValue: (drives) => {
      const temps = drives.map(d => d.temperature_c).filter(t => t != null)
      const avg = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null
      return { value: avg != null ? `${avg}°C` : '—' }
    },
  },
  hottest_drive: {
    label: 'Hottest Drive',
    icon: Flame,
    colorVar: 'var(--wt-warn-500)',
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
    colorVar: 'var(--wt-viz-6)',
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
    colorVar: 'var(--wt-brand-500)',
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
    colorVar: 'var(--wt-teal-600)',
    getValue: (drives, profiles, baysMap) => {
      const all = Object.values(baysMap).flat()
      const n = all.filter(b => b.drive_serial).length
      return { value: `${n}/${all.length}` }
    },
  },
  health_pct: {
    label: 'Drive Health',
    icon: Activity,
    colorVar: 'var(--wt-up-600)',
    getValue: (drives) => {
      if (!drives.length) return { value: '—' }
      const pct = Math.round(drives.filter(d => d.smart_status === 'PASSED').length / drives.length * 100)
      return { value: `${pct}%` }
    },
  },
  reallocated: {
    label: 'Reallocated',
    icon: AlertTriangle,
    colorVar: 'var(--wt-warn-600)',
    getValue: (drives) => {
      const total = drives.reduce((s, d) => s + (d.reallocated_sectors || 0), 0)
      return { value: total, sub: 'sectors total' }
    },
  },
  ssd_count: {
    label: 'SSDs',
    icon: Cpu,
    colorVar: 'var(--wt-viz-6)',
    getValue: (drives) => ({ value: drives.filter(d => d.rpm === 0).length }),
  },
  hdd_count: {
    label: 'HDDs',
    icon: HardDrive,
    colorVar: 'var(--wt-text-subtle)',
    getValue: (drives) => ({ value: drives.filter(d => d.rpm > 0).length }),
  },
  warranty_warnings: {
    label: 'Warranty',
    icon: ShieldAlert,
    colorVar: 'var(--wt-warn-600)',
    getValue: (drives, profiles) => {
      const n = profiles.filter(p => p.warranty_days_remaining != null && p.warranty_days_remaining <= 90).length
      return { value: n, sub: 'expiring soon' }
    },
  },
  disconnected: {
    label: 'Disconnected',
    icon: WifiOff,
    colorVar: 'var(--wt-warn-600)',
    getValue: (drives) => ({ value: drives.filter(d => d.is_connected === false).length, sub: 'not detected' }),
  },
  uncorrectable: {
    label: 'Uncorrectable',
    icon: Bug,
    colorVar: 'var(--wt-down-500)',
    getValue: (drives) => ({
      value: drives.reduce((s, d) => s + (d.uncorrectable_errors || 0), 0),
      sub: 'errors total',
    }),
  },
  zfs_pools: {
    label: 'ZFS Pools',
    icon: Layers,
    colorVar: 'var(--wt-brand-500)',
    getValue: (drives) => ({
      value: new Set(drives.map(d => d.zfs_pool).filter(Boolean)).size,
      sub: 'active pools',
    }),
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
      className={`wt-card group relative flex items-center gap-3 px-4 h-[72px] shrink-0 select-none transition-[box-shadow,border-color] ${hasDetail ? 'cursor-pointer hover:shadow-[var(--wt-shadow-md)]' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div className="shrink-0" style={{ color: def.colorVar }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="wt-eyebrow mb-1">{def.label}</p>
        <p className="wt-mono font-semibold leading-none" style={{ fontSize: 'var(--wt-text-lg)', color: def.colorVar }}>{value}</p>
      </div>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onRemove(id) }}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white transition-colors items-center justify-center hidden group-hover:flex"
        style={{ background: 'var(--wt-down-500)' }}
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
          <div className="flex items-center gap-3 px-5 py-3 overflow-x-auto" style={{ borderBottom: '1px solid var(--wt-border)' }}>
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
              className="wt-btn wt-btn--ghost shrink-0 h-[72px] px-4 rounded-[var(--wt-r-lg)]"
              style={{ border: '1px dashed var(--wt-border-strong)' }}
            >
              <Plus size={16} />
              <span className="wt-eyebrow">Add</span>
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
