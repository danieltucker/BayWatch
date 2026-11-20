import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  Activity, AlertTriangle, Bug, CheckCircle2, Clock, Cpu, Database, Flame, HardDrive, LayoutGrid,
  Layers, Plus, ShieldAlert, Thermometer, WifiOff, X, XCircle,
} from 'lucide-react'
import { getAppConfig, saveAppConfig } from '../../api/client'
import { computeWidget, DEFAULT_WIDGET_IDS, isValidWidgetList, WIDGET_IDS } from '../../lib/widgets'
import { useIsMobile } from '../../hooks/useMediaQuery'
import Dialog from '../ui/Dialog'
import { Kv, Sparkline } from '../ui/bits'

const ICON = {
  total_drives: HardDrive, healthy: CheckCircle2, failed: XCircle, avg_temp: Thermometer, hottest_drive: Flame,
  oldest_drive: Clock, total_capacity: Database, assigned_bays: LayoutGrid, health_pct: Activity,
  reallocated: AlertTriangle, ssd_count: Cpu, hdd_count: HardDrive, warranty_warnings: ShieldAlert,
  disconnected: WifiOff, uncorrectable: Bug, zfs_pools: Layers,
}

const STORAGE_KEY = 'widget-config'

function loadLocal() {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (isValidWidgetList(ids)) return ids
  } catch { /* ignore */ }
  return [...DEFAULT_WIDGET_IDS]
}

/** Persisted widget selection: localStorage for a fast first paint, the API as cross-browser truth. */
function useWidgetIds() {
  const [ids, setIds] = useState(loadLocal)
  useEffect(() => {
    getAppConfig('widgets').then(data => {
      const parsed = JSON.parse(data.value)
      if (isValidWidgetList(parsed)) {
        setIds(parsed)
        try { localStorage.setItem(STORAGE_KEY, data.value) } catch { /* ignore */ }
      }
    }).catch(() => {})
  }, [])
  function save(next) {
    setIds(next)
    const json = JSON.stringify(next)
    try { localStorage.setItem(STORAGE_KEY, json) } catch { /* ignore */ }
    saveAppConfig('widgets', json).catch(() => {})
  }
  return [ids, save]
}

function WidgetDetails({ w }) {
  return (
    <>
      <div>
        {w.rows.length === 0 && <p className="bw-sub">Nothing to show yet.</p>}
        {w.rows.map(([k, v], i) => <Kv key={i} k={k} v={v} />)}
      </div>
      {w.note && <p className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>{w.note}</p>}
    </>
  )
}

function WidgetCard({ w, featured, editing, open, onToggle, onRemove, panelRight, spark, isMobile }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id, disabled: !editing })
  const Icon = ICON[w.id] || Activity
  const tone = featured ? 'ink' : w.tone
  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition, zIndex: isDragging ? 20 : open ? 25 : undefined, opacity: isDragging ? 0.7 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className={`bw-widget ${featured ? 'bw-widget--feat' : ''}`}>
      <button
        type="button"
        className="bw-widget__btn"
        aria-expanded={editing ? undefined : open}
        aria-label={editing ? `${w.label}, ${w.value}. Drag to reorder` : `${w.label}, ${w.value}`}
        onClick={editing ? undefined : onToggle}
        style={editing ? { cursor: 'grab', touchAction: 'none' } : undefined}
        {...(editing ? { ...attributes, ...listeners } : {})}
      >
        <span className={`bw-chipicon ${tone ? `bw-chipicon--${tone}` : ''}`} style={isMobile ? { width: 28, height: 28 } : undefined}>
          <Icon size={isMobile ? 14 : 17} aria-hidden="true" />
        </span>
        <span className="block relative min-w-0">
          <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--wt-text-muted)' }}>{w.label}</span>
          <span className="block bw-metric bw-widget__value truncate"
            style={w.tone === 'warn' || w.tone === 'down' ? { color: `var(--wt-${w.tone}-600)` } : undefined}>
            {w.value}
          </span>
        </span>
        {featured && spark?.length > 1 && !isMobile && (
          <span className="absolute right-4 top-4 w-[88px]" aria-hidden="true">
            <Sparkline values={spark} height={34} color="var(--bw-ink)" fill />
          </span>
        )}
      </button>
      {editing && (
        <button type="button" className="bw-widget__remove" onClick={onRemove} aria-label={`Remove ${w.label} widget`}>
          <span><X size={14} aria-hidden="true" /></span>
        </button>
      )}
      {open && !editing && !isMobile && (
        <div role="dialog" aria-label={`${w.label} details`} className="bw-popover" style={panelRight ? { right: 0 } : { left: 0 }}>
          <div className="flex justify-between items-start gap-2">
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--wt-text-muted)' }}>{w.label}</div>
              <div className="bw-metric" style={{ fontSize: 'var(--wt-text-2xl)' }}>{w.value}</div>
            </div>
            <button type="button" className="bw-iconbtn bw-iconbtn--sm" onClick={onToggle} aria-label="Close">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <WidgetDetails w={w} />
        </div>
      )}
    </div>
  )
}

export default function Widgets({ ctx, spark }) {
  const isMobile = useIsMobile()
  const [ids, save] = useWidgetIds()
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const wrapRef = useRef(null)

  const widgets = useMemo(() => ids.map(id => computeWidget(id, ctx)).filter(Boolean), [ids, ctx])
  const hidden = WIDGET_IDS.filter(id => !ids.includes(id)).map(id => computeWidget(id, ctx))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Close desktop popovers on outside click / Escape.
  useEffect(() => {
    if (isMobile || (!openId && !adding)) return
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) { setOpenId(null); setAdding(false) } }
    const onKey = e => { if (e.key === 'Escape') { setOpenId(null); setAdding(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [openId, adding, isMobile])

  const open = widgets.find(w => w.id === openId)
  const half = Math.ceil(widgets.length / 2)

  const addList = (
    <div className="flex flex-col">
      {hidden.length === 0 && <p className="bw-sub py-2">Every widget is already on the dashboard.</p>}
      {hidden.map(w => {
        const Icon = ICON[w.id] || Activity
        return (
          <button key={w.id} type="button" className="bw-row" style={{ minHeight: 52 }}
            aria-label={`Add ${w.label} widget`}
            onClick={() => { save([...ids, w.id]); if (hidden.length <= 1) setAdding(false) }}>
            <span className="bw-chipicon"><Icon size={16} aria-hidden="true" /></span>
            <span className="flex-1 font-semibold">{w.label}</span>
            <span className="wt-mono text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>{w.value}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <section aria-label="Widgets" className="flex flex-col gap-3" ref={wrapRef} data-screen-label="Widgets">
      <div className="flex justify-between items-center">
        <span className="wt-eyebrow">Widgets</span>
        <button type="button" className="wt-btn wt-btn--secondary" style={{ minHeight: 36 }}
          aria-pressed={editing} onClick={() => { setEditing(e => !e); setOpenId(null); setAdding(false) }}>
          {editing ? 'Done' : 'Edit widgets'}
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => { if (over && active.id !== over.id) save(arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id))) }}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="bw-widgets">
            {widgets.map((w, i) => (
              <WidgetCard key={w.id} w={w} featured={i === 0} editing={editing} isMobile={isMobile}
                open={openId === w.id} panelRight={i >= half} spark={spark}
                onToggle={() => { setOpenId(openId === w.id ? null : w.id); setAdding(false) }}
                onRemove={() => { save(ids.filter(x => x !== w.id)); setOpenId(null) }} />
            ))}
            <div className="bw-widget" style={{ position: 'relative' }}>
              <button type="button" className="bw-widget__add" aria-expanded={adding}
                onClick={() => { setAdding(a => !a); setOpenId(null) }}>
                <span className="bw-chipicon bw-chipicon--ink"><Plus size={16} aria-hidden="true" /></span>
                Add widget
              </button>
              {adding && !isMobile && (
                <div role="dialog" aria-label="Add widget" className="bw-popover" style={{ right: 0 }}>
                  <div className="font-bold">Add a widget</div>
                  {addList}
                </div>
              )}
            </div>
          </div>
        </SortableContext>
      </DndContext>

      {isMobile && open && (
        <Dialog label={`${open.label} details`} onClose={() => setOpenId(null)}
          title={<span className="text-[13px] font-medium" style={{ color: 'var(--wt-text-muted)' }}>{open.label}</span>}
          subtitle={<span className="bw-metric" style={{ fontSize: 'var(--wt-text-2xl)', color: 'var(--wt-text)' }}>{open.value}</span>}>
          <WidgetDetails w={open} />
        </Dialog>
      )}
      {isMobile && adding && (
        <Dialog title="Add a widget" onClose={() => setAdding(false)}>{addList}</Dialog>
      )}
    </section>
  )
}
