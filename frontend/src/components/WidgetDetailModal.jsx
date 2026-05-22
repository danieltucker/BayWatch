import { X } from 'lucide-react'
import { WIDGET_DEFS } from './WidgetBar'

function formatHours(h) {
  if (h == null) return '—'
  return `${(h / 24 / 365).toFixed(1)}y`
}

function formatTemp(t, warnC = 55, dangerC = 60) {
  if (t == null) return '—'
  const cls =
    t >= dangerC ? 'text-red-500' :
    t >= warnC   ? 'text-amber-500' : 'text-sky-500'
  return <span className={cls}>{t}°C</span>
}

function DriveRow({ drive, value, sub }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-gray-800/60 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">
          {drive.model || drive.serial}
        </p>
        <p className="text-xs text-slate-400 dark:text-gray-600 font-mono">{drive.serial}</p>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className="text-sm font-bold">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-gray-600">{sub}</p>}
      </div>
    </div>
  )
}

function DetailContent({ widgetId, drives, profiles }) {
  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))

  if (widgetId === 'failed') {
    const failed = drives.filter(d => d.smart_status === 'FAILED')
    if (!failed.length) return <p className="text-sm text-slate-500 dark:text-gray-500">No failed drives.</p>
    return failed.map(d => <DriveRow key={d.serial} drive={d} value={<span className="text-red-500">FAILED</span>} />)
  }

  if (widgetId === 'hottest_drive') {
    const sorted = drives.filter(d => d.temperature_c != null).sort((a, b) => b.temperature_c - a.temperature_c).slice(0, 10)
    if (!sorted.length) return <p className="text-sm text-slate-500 dark:text-gray-500">No temperature data.</p>
    return sorted.map(d => <DriveRow key={d.serial} drive={d} value={formatTemp(d.temperature_c)} />)
  }

  if (widgetId === 'oldest_drive') {
    const sorted = drives.filter(d => d.power_on_hours != null).sort((a, b) => b.power_on_hours - a.power_on_hours).slice(0, 10)
    if (!sorted.length) return <p className="text-sm text-slate-500 dark:text-gray-500">No power-on hours data.</p>
    return sorted.map(d => (
      <DriveRow key={d.serial} drive={d} value={formatHours(d.power_on_hours)} sub={`${d.power_on_hours?.toLocaleString()}h`} />
    ))
  }

  if (widgetId === 'warranty_warnings') {
    const expiring = profiles.filter(p => p.warranty_days_remaining != null && p.warranty_days_remaining <= 90)
      .sort((a, b) => a.warranty_days_remaining - b.warranty_days_remaining)
    if (!expiring.length) return <p className="text-sm text-slate-500 dark:text-gray-500">No warranties expiring soon.</p>
    return expiring.map(p => {
      const d = drives.find(dr => dr.serial === p.serial)
      if (!d) return null
      const days = p.warranty_days_remaining
      const cls = days < 0 ? 'text-red-500' : 'text-amber-500'
      const label = days < 0 ? `Expired ${Math.abs(Math.round(days / 30))}mo ago` : `${Math.round(days / 30)}mo left`
      return <DriveRow key={p.serial} drive={d} value={<span className={cls}>{label}</span>} />
    })
  }

  if (widgetId === 'reallocated') {
    const withSectors = drives.filter(d => (d.reallocated_sectors ?? 0) > 0).sort((a, b) => b.reallocated_sectors - a.reallocated_sectors)
    if (!withSectors.length) return <p className="text-sm text-slate-500 dark:text-gray-500">No reallocated sectors detected.</p>
    return withSectors.map(d => (
      <DriveRow key={d.serial} drive={d} value={<span className="text-amber-500">{d.reallocated_sectors}</span>} sub="sectors" />
    ))
  }

  return null
}

export const WIDGET_HAS_DETAIL = new Set(['failed', 'hottest_drive', 'oldest_drive', 'warranty_warnings', 'reallocated'])

export default function WidgetDetailModal({ widgetId, drives, profiles, onClose }) {
  const def = WIDGET_DEFS[widgetId]
  if (!def) return null
  const Icon = def.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <Icon size={16} className={def.color} />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{def.label}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <DetailContent widgetId={widgetId} drives={drives} profiles={profiles} />
        </div>
      </div>
    </div>
  )
}
