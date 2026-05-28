import { X } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts'
import { WIDGET_DEFS } from './WidgetBar'

export const WIDGET_HAS_DETAIL = new Set([
  'failed', 'hottest_drive', 'oldest_drive', 'warranty_warnings', 'reallocated',
  'healthy', 'avg_temp', 'health_pct', 'total_drives',
])

const tooltipStyle = {
  fontSize: 10, padding: '4px 8px', borderRadius: 6,
  border: 'none', background: 'rgba(15,23,42,0.90)', color: '#e2e8f0',
}

function StatPill({ label, value, color = 'text-slate-600 dark:text-gray-300' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800 px-4 py-3 flex-1">
      <span className={`text-xl font-bold leading-none ${color}`}>{value}</span>
      <span className="text-[10px] text-slate-400 dark:text-gray-600 mt-1 text-center">{label}</span>
    </div>
  )
}

function TempBar({ temp, max = 70, warnC = 55, dangerC = 60 }) {
  const pct = Math.min(100, (temp / max) * 100)
  const color = temp >= dangerC ? 'bg-red-400' : temp >= warnC ? 'bg-amber-400' : 'bg-sky-400'
  const textColor = temp >= dangerC ? 'text-red-500' : temp >= warnC ? 'text-amber-500' : 'text-sky-500'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right shrink-0 ${textColor}`}>{temp}°C</span>
    </div>
  )
}

function PohBar({ hours }) {
  const pct = Math.min(100, (hours / 50000) * 100)
  const color = hours >= 40000 ? 'bg-orange-400' : hours >= 25000 ? 'bg-amber-400' : 'bg-indigo-400'
  const years = (hours / 24 / 365).toFixed(1)
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-10 text-right shrink-0 text-slate-500 dark:text-gray-400">{years}y</span>
    </div>
  )
}

function DriveRow({ drive, children }) {
  return (
    <div className="py-2.5 border-b border-slate-100 dark:border-gray-800/60 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 dark:text-gray-200 truncate">
            {drive.make ? `${drive.make} ${drive.model || ''}`.trim() : drive.model || drive.serial}
          </p>
          <p className="text-[10px] font-mono text-slate-400 dark:text-gray-600">{drive.serial}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold text-slate-400 dark:text-gray-600 uppercase tracking-widest mb-2 mt-3 first:mt-0">
      {children}
    </p>
  )
}

function DetailContent({ widgetId, drives, profiles }) {
  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))

  // ── Failed ──────────────────────────────────────────────────────────────────
  if (widgetId === 'failed') {
    const failed = drives.filter(d => d.smart_status === 'FAILED')
    if (!failed.length) {
      return <EmptyState message="No failed drives — all clear." icon="✓" color="text-emerald-500" />
    }
    return (
      <>
        <SectionLabel>{failed.length} {failed.length === 1 ? 'drive' : 'drives'} with SMART failures</SectionLabel>
        {failed.map(d => (
          <DriveRow key={d.serial} drive={d}>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: 'Realloc', value: d.reallocated_sectors },
                { label: 'Pending', value: d.pending_sectors },
                { label: 'Uncorr.', value: d.uncorrectable_errors },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-lg px-2 py-1.5 text-center border ${
                  (value ?? 0) > 0
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40'
                    : 'bg-slate-50 dark:bg-gray-800/30 border-slate-200 dark:border-gray-700/40'
                }`}>
                  <p className={`text-sm font-bold ${(value ?? 0) > 0 ? 'text-red-500' : 'text-slate-300 dark:text-gray-700'}`}>
                    {value ?? '—'}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-gray-600">{label}</p>
                </div>
              ))}
            </div>
          </DriveRow>
        ))}
      </>
    )
  }

  // ── Hottest drive ────────────────────────────────────────────────────────────
  if (widgetId === 'hottest_drive') {
    const sorted = drives.filter(d => d.temperature_c != null)
      .sort((a, b) => b.temperature_c - a.temperature_c).slice(0, 10)
    if (!sorted.length) return <EmptyState message="No temperature data available." />
    const hottest = sorted[0].temperature_c
    const coolest = sorted[sorted.length - 1].temperature_c
    const avg = Math.round(sorted.reduce((s, d) => s + d.temperature_c, 0) / sorted.length)
    return (
      <>
        <div className="flex gap-2 mb-4">
          <StatPill label="Hottest" value={`${hottest}°C`} color="text-orange-500" />
          <StatPill label="Average" value={`${avg}°C`} color="text-sky-500" />
          <StatPill label="Coolest" value={`${coolest}°C`} color="text-emerald-500" />
        </div>
        <SectionLabel>Top 10 by temperature</SectionLabel>
        {sorted.map(d => (
          <DriveRow key={d.serial} drive={d}>
            <TempBar temp={d.temperature_c} />
          </DriveRow>
        ))}
      </>
    )
  }

  // ── Oldest drive ─────────────────────────────────────────────────────────────
  if (widgetId === 'oldest_drive') {
    const sorted = drives.filter(d => d.power_on_hours != null)
      .sort((a, b) => b.power_on_hours - a.power_on_hours).slice(0, 10)
    if (!sorted.length) return <EmptyState message="No power-on hours data available." />
    const oldest = sorted[0].power_on_hours
    const total = drives.reduce((s, d) => s + (d.power_on_hours || 0), 0)
    return (
      <>
        <div className="flex gap-2 mb-4">
          <StatPill label="Most hours" value={`${(oldest / 24 / 365).toFixed(1)}y`} color="text-purple-500" />
          <StatPill label="Fleet total" value={`${Math.round(total / 1000)}k h`} color="text-slate-600 dark:text-gray-300" />
        </div>
        <SectionLabel>Top 10 by age</SectionLabel>
        {sorted.map(d => (
          <DriveRow key={d.serial} drive={d}>
            <PohBar hours={d.power_on_hours} />
          </DriveRow>
        ))}
      </>
    )
  }

  // ── Warranty warnings ────────────────────────────────────────────────────────
  if (widgetId === 'warranty_warnings') {
    const expiring = profiles
      .filter(p => p.warranty_days_remaining != null && p.warranty_days_remaining <= 90)
      .sort((a, b) => a.warranty_days_remaining - b.warranty_days_remaining)
    if (!expiring.length) return <EmptyState message="No warranties expiring within 90 days." icon="✓" color="text-emerald-500" />
    return (
      <>
        <SectionLabel>{expiring.length} warranty {expiring.length === 1 ? 'expiry' : 'expiries'} within 90 days</SectionLabel>
        {expiring.map(p => {
          const d = drives.find(dr => dr.serial === p.serial)
          if (!d) return null
          const days = p.warranty_days_remaining
          const isExpired = days < 0
          return (
            <DriveRow key={p.serial} drive={d}>
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                isExpired
                  ? 'bg-red-100 dark:bg-red-950/40 text-red-500'
                  : days <= 30
                  ? 'bg-orange-100 dark:bg-orange-950/30 text-orange-500'
                  : 'bg-amber-100 dark:bg-amber-950/30 text-amber-600'
              }`}>
                {isExpired ? `Expired ${Math.abs(Math.round(days / 30))}mo ago` : `${Math.round(days / 30)}mo remaining`}
              </div>
            </DriveRow>
          )
        })}
      </>
    )
  }

  // ── Reallocated sectors ──────────────────────────────────────────────────────
  if (widgetId === 'reallocated') {
    const withSectors = drives
      .filter(d => (d.reallocated_sectors ?? 0) > 0)
      .sort((a, b) => b.reallocated_sectors - a.reallocated_sectors)
    if (!withSectors.length) return <EmptyState message="No reallocated sectors detected." icon="✓" color="text-emerald-500" />
    const chartData = withSectors.slice(0, 8).map(d => ({
      name: d.serial.slice(-6),
      sectors: d.reallocated_sectors,
    }))
    return (
      <>
        <SectionLabel>{withSectors.length} {withSectors.length === 1 ? 'drive' : 'drives'} with reallocated sectors</SectionLabel>
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Sectors']} labelStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="sectors" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {withSectors.map(d => (
          <DriveRow key={d.serial} drive={d}>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.min(100, (d.reallocated_sectors / Math.max(...withSectors.map(x => x.reallocated_sectors))) * 100)}%` }} />
              </div>
              <span className="text-xs font-bold text-amber-500 w-12 text-right shrink-0">{d.reallocated_sectors} sec</span>
            </div>
          </DriveRow>
        ))}
      </>
    )
  }

  // ── Healthy drives ───────────────────────────────────────────────────────────
  if (widgetId === 'healthy') {
    const healthy = drives.filter(d => d.smart_status === 'PASSED')
    const withErrors = healthy.filter(d =>
      (d.reallocated_sectors ?? 0) > 0 || (d.pending_sectors ?? 0) > 0 || (d.uncorrectable_errors ?? 0) > 0
    )
    const clean = healthy.filter(d =>
      (d.reallocated_sectors ?? 0) === 0 && (d.pending_sectors ?? 0) === 0 && (d.uncorrectable_errors ?? 0) === 0
    )
    if (!healthy.length) return <EmptyState message="No drives have passed SMART." />
    return (
      <>
        <div className="flex gap-2 mb-4">
          <StatPill label="Clean" value={clean.length} color="text-emerald-500" />
          <StatPill label="Passed w/ errors" value={withErrors.length} color="text-amber-500" />
        </div>
        {withErrors.length > 0 && (
          <>
            <SectionLabel>Passed SMART but have errors</SectionLabel>
            {withErrors.map(d => (
              <DriveRow key={d.serial} drive={d}>
                <div className="flex gap-2">
                  {(d.reallocated_sectors ?? 0) > 0 && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/30 text-amber-600 rounded px-1.5 py-0.5">
                      {d.reallocated_sectors} realloc
                    </span>
                  )}
                  {(d.pending_sectors ?? 0) > 0 && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/30 text-amber-600 rounded px-1.5 py-0.5">
                      {d.pending_sectors} pending
                    </span>
                  )}
                  {(d.uncorrectable_errors ?? 0) > 0 && (
                    <span className="text-[10px] bg-orange-100 dark:bg-orange-950/30 text-orange-600 rounded px-1.5 py-0.5">
                      {d.uncorrectable_errors} uncorr
                    </span>
                  )}
                </div>
              </DriveRow>
            ))}
          </>
        )}
        <SectionLabel>All {healthy.length} passing drives</SectionLabel>
        {healthy.slice(0, 20).map(d => (
          <div key={d.serial} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-gray-800/50 last:border-0">
            <span className="text-xs text-slate-700 dark:text-gray-300 font-mono truncate">{d.serial}</span>
            <span className="text-[10px] text-emerald-500 ml-2 shrink-0">PASSED</span>
          </div>
        ))}
      </>
    )
  }

  // ── Average temperature ──────────────────────────────────────────────────────
  if (widgetId === 'avg_temp') {
    const withTemp = drives.filter(d => d.temperature_c != null)
    if (!withTemp.length) return <EmptyState message="No temperature data available." />

    // Build histogram buckets in 5°C steps
    const buckets = {}
    withTemp.forEach(d => {
      const bucket = Math.floor(d.temperature_c / 5) * 5
      buckets[bucket] = (buckets[bucket] || 0) + 1
    })
    const chartData = Object.entries(buckets)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([temp, count]) => ({ temp: `${temp}°`, count }))

    const avg = Math.round(withTemp.reduce((s, d) => s + d.temperature_c, 0) / withTemp.length)
    const hot = drives.filter(d => d.temperature_c != null).sort((a, b) => b.temperature_c - a.temperature_c).slice(0, 5)

    return (
      <>
        <div className="flex gap-2 mb-4">
          <StatPill label="Average" value={`${avg}°C`} color="text-sky-500" />
          <StatPill label="Monitored" value={withTemp.length} color="text-slate-600 dark:text-gray-300" />
        </div>
        <SectionLabel>Temperature distribution</SectionLabel>
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="temp" tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Drives']} labelStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="count" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SectionLabel>5 hottest drives</SectionLabel>
        {hot.map(d => (
          <DriveRow key={d.serial} drive={d}>
            <TempBar temp={d.temperature_c} />
          </DriveRow>
        ))}
      </>
    )
  }

  // ── Drive health % ───────────────────────────────────────────────────────────
  if (widgetId === 'health_pct') {
    const classifyDrive = (d) => {
      if (d.smart_status === 'FAILED') return 'replace_now'
      const hasErrors = (d.reallocated_sectors ?? 0) > 0 || (d.pending_sectors ?? 0) > 0 || (d.uncorrectable_errors ?? 0) > 0
      if (hasErrors) return 'replace_soon'
      if (d.smart_status === 'PASSED') {
        if ((d.power_on_hours ?? 0) > 45000) return 'monitor'
        return 'healthy'
      }
      return 'monitor'
    }

    const TIERS = [
      { key: 'replace_now',  label: 'Replace Immediately',   dotColor: '#ef4444', badgeClass: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-500' },
      { key: 'replace_soon', label: 'Replace When Possible', dotColor: '#f97316', badgeClass: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40 text-orange-500' },
      { key: 'monitor',      label: 'Monitor Closely',       dotColor: '#f59e0b', badgeClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-600' },
      { key: 'healthy',      label: 'Healthy',               dotColor: '#22c55e', badgeClass: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-600' },
    ]

    const grouped = {}
    for (const t of TIERS) grouped[t.key] = []
    for (const d of drives) grouped[classifyDrive(d)].push(d)

    return (
      <>
        <div className="flex gap-2 mb-5">
          {TIERS.map(t => (
            <div key={t.key} className={`flex-1 rounded-xl border px-2 py-2.5 text-center ${t.badgeClass}`}>
              <p className="text-xl font-bold leading-none">{grouped[t.key].length}</p>
              <p className="text-[8px] mt-1 leading-tight opacity-80">{t.label}</p>
            </div>
          ))}
        </div>

        {TIERS.filter(t => grouped[t.key].length > 0).map(tier => (
          <div key={tier.key} className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5 mt-2 first:mt-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tier.dotColor }} />
              <p className="text-[10px] font-semibold text-slate-500 dark:text-gray-500 uppercase tracking-widest">
                {tier.label} — {grouped[tier.key].length}
              </p>
            </div>
            {grouped[tier.key].map(d => (
              <DriveRow key={d.serial} drive={d}>
                <div className="flex flex-wrap gap-1.5">
                  {d.smart_status === 'FAILED' && (
                    <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-500 rounded px-1.5 py-0.5">SMART FAILED</span>
                  )}
                  {(d.reallocated_sectors ?? 0) > 0 && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/30 text-amber-600 rounded px-1.5 py-0.5">{d.reallocated_sectors} realloc</span>
                  )}
                  {(d.pending_sectors ?? 0) > 0 && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/30 text-amber-600 rounded px-1.5 py-0.5">{d.pending_sectors} pending</span>
                  )}
                  {(d.uncorrectable_errors ?? 0) > 0 && (
                    <span className="text-[10px] bg-orange-100 dark:bg-orange-950/30 text-orange-600 rounded px-1.5 py-0.5">{d.uncorrectable_errors} uncorr</span>
                  )}
                  {tier.key === 'monitor' && (d.reallocated_sectors ?? 0) === 0 && (d.pending_sectors ?? 0) === 0 && (d.uncorrectable_errors ?? 0) === 0 && (
                    <span className="text-[10px] bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 rounded px-1.5 py-0.5">
                      {d.smart_status === 'PASSED'
                        ? `${((d.power_on_hours ?? 0) / 24 / 365).toFixed(1)}y old`
                        : 'No SMART data'}
                    </span>
                  )}
                  {tier.key === 'healthy' && (
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 rounded px-1.5 py-0.5">PASSED</span>
                  )}
                </div>
              </DriveRow>
            ))}
          </div>
        ))}
      </>
    )
  }

  // ── Total drives breakdown ───────────────────────────────────────────────────
  if (widgetId === 'total_drives') {
    const ssds = drives.filter(d => d.rpm === 0)
    const hdds = drives.filter(d => d.rpm > 0)
    const other = drives.filter(d => d.rpm == null)

    const byFormFactor = {}
    drives.forEach(d => {
      const ff = d.form_factor || 'Unknown'
      byFormFactor[ff] = (byFormFactor[ff] || 0) + 1
    })
    const ffData = Object.entries(byFormFactor)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))

    const totalCap = drives.reduce((s, d) => s + (d.capacity_bytes || 0), 0)
    const tb = totalCap / 1e12

    return (
      <>
        <div className="flex gap-2 mb-4">
          <StatPill label="SSDs" value={ssds.length} color="text-violet-500" />
          <StatPill label="HDDs" value={hdds.length} color="text-slate-600 dark:text-gray-300" />
          <StatPill label="Total" value={tb >= 1 ? `${tb.toFixed(1)} TB` : `${(totalCap / 1e9).toFixed(0)} GB`} color="text-blue-500" />
        </div>
        <SectionLabel>By form factor</SectionLabel>
        <div className="flex flex-col gap-1.5 mb-4">
          {ffData.map(({ name, value }) => (
            <div key={name} className="flex items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-gray-400 w-20 shrink-0">{name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-blue-400" style={{ width: `${(value / drives.length) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-gray-300 w-6 text-right">{value}</span>
            </div>
          ))}
        </div>
        {other.length > 0 && (
          <>
            <SectionLabel>{other.length} drives with unknown type</SectionLabel>
            {other.map(d => (
              <div key={d.serial} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-gray-800/50 last:border-0">
                <span className="text-xs text-slate-600 dark:text-gray-300 truncate">{d.model || d.serial}</span>
                <span className="text-[10px] font-mono text-slate-400 dark:text-gray-600 ml-2 shrink-0">{d.serial.slice(-6)}</span>
              </div>
            ))}
          </>
        )}
      </>
    )
  }

  return null
}

function EmptyState({ message, icon = '—', color = 'text-slate-400' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <span className={`text-2xl ${color}`}>{icon}</span>
      <p className="text-sm text-slate-500 dark:text-gray-500 text-center">{message}</p>
    </div>
  )
}

export default function WidgetDetailModal({ widgetId, drives, profiles, onClose }) {
  const def = WIDGET_DEFS[widgetId]
  if (!def) return null
  const Icon = def.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center ${def.color}`}>
              <Icon size={14} />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{def.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800"
          >
            <X size={15} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DetailContent widgetId={widgetId} drives={drives} profiles={profiles} />
        </div>
      </div>
    </div>
  )
}
