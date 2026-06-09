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

const axisStyle = { fontSize: 8, fill: 'var(--wt-text-faint)' }

function StatPill({ label, value, color = 'var(--wt-text-muted)' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border px-4 py-3 flex-1"
      style={{ background: 'var(--wt-surface-2)', borderColor: 'var(--wt-border)' }}>
      <span className="wt-mono text-xl font-bold leading-none" style={{ color }}>{value}</span>
      <span className="text-[10px] mt-1 text-center" style={{ color: 'var(--wt-text-faint)' }}>{label}</span>
    </div>
  )
}

function TempBar({ temp, max = 70, warnC = 55, dangerC = 60 }) {
  const pct = Math.min(100, (temp / max) * 100)
  const fillColor = temp >= dangerC ? 'var(--wt-down-500)' : temp >= warnC ? 'var(--wt-warn-500)' : 'var(--bw-ink)'
  const textColor = temp >= dangerC ? 'var(--wt-down-500)' : temp >= warnC ? 'var(--wt-warn-600)' : 'var(--bw-ink)'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--wt-n-200)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <span className="wt-mono text-xs font-bold w-10 text-right shrink-0" style={{ color: textColor }}>{temp}°C</span>
    </div>
  )
}

function PohBar({ hours }) {
  const pct = Math.min(100, (hours / 50000) * 100)
  const fillColor = hours >= 40000 ? 'var(--wt-warn-600)' : hours >= 25000 ? 'var(--wt-warn-500)' : 'var(--wt-viz-5)'
  const years = (hours / 24 / 365).toFixed(1)
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--wt-n-200)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fillColor }} />
      </div>
      <span className="wt-mono text-xs font-bold w-10 text-right shrink-0" style={{ color: 'var(--wt-text-muted)' }}>{years}y</span>
    </div>
  )
}

function DriveRow({ drive, children }) {
  return (
    <div className="py-2.5 last:border-0" style={{ borderBottom: '1px solid var(--wt-border)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--wt-text)' }}>
            {drive.make ? `${drive.make} ${drive.model || ''}`.trim() : drive.model || drive.serial}
          </p>
          <p className="wt-mono text-[10px]" style={{ color: 'var(--wt-text-faint)' }}>{drive.serial}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="wt-eyebrow mb-2 mt-3 first:mt-0">{children}</p>
}

function EmptyState({ message, icon = '—', color = 'var(--wt-text-faint)' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <span className="text-2xl" style={{ color }}>{icon}</span>
      <p className="text-sm text-center" style={{ color: 'var(--wt-text-muted)' }}>{message}</p>
    </div>
  )
}

function DetailContent({ widgetId, drives, profiles }) {
  // ── Failed ──────────────────────────────────────────────────────────────────
  if (widgetId === 'failed') {
    const failed = drives.filter(d => d.smart_status === 'FAILED')
    if (!failed.length) {
      return <EmptyState message="No failed drives — all clear." icon="✓" color="var(--wt-up-600)" />
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
                <div key={label} className="rounded-lg px-2 py-1.5 text-center border"
                  style={(value ?? 0) > 0
                    ? { background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }
                    : { background: 'var(--wt-surface-2)', borderColor: 'var(--wt-border)' }
                  }>
                  <p className="wt-mono text-sm font-bold"
                    style={{ color: (value ?? 0) > 0 ? 'var(--wt-down-500)' : 'var(--wt-text-faint)' }}>
                    {value ?? '—'}
                  </p>
                  <p className="text-[9px]" style={{ color: 'var(--wt-text-faint)' }}>{label}</p>
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
          <StatPill label="Hottest" value={`${hottest}°C`} color="var(--wt-warn-500)" />
          <StatPill label="Average" value={`${avg}°C`} color="var(--bw-ink)" />
          <StatPill label="Coolest" value={`${coolest}°C`} color="var(--wt-up-600)" />
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
          <StatPill label="Most hours" value={`${(oldest / 24 / 365).toFixed(1)}y`} color="var(--wt-viz-6)" />
          <StatPill label="Fleet total" value={`${Math.round(total / 1000)}k h`} />
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
    if (!expiring.length) return <EmptyState message="No warranties expiring within 90 days." icon="✓" color="var(--wt-up-600)" />
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
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold"
                style={isExpired
                  ? { background: 'var(--wt-down-50)', color: 'var(--wt-down-500)' }
                  : days <= 30
                  ? { background: 'var(--wt-warn-50)', color: 'var(--wt-warn-600)' }
                  : { background: 'var(--wt-warn-50)', color: 'var(--wt-warn-500)' }
                }>
                {isExpired ? `Expired ${Math.abs(Math.round(days / 30))}mo ago` : `${Math.round(days / 30)}mo remaining`}
              </span>
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
    if (!withSectors.length) return <EmptyState message="No reallocated sectors detected." icon="✓" color="var(--wt-up-600)" />
    const chartData = withSectors.slice(0, 8).map(d => ({
      name: d.serial.slice(-6),
      sectors: d.reallocated_sectors,
    }))
    const maxSectors = Math.max(...withSectors.map(x => x.reallocated_sectors))
    return (
      <>
        <SectionLabel>{withSectors.length} {withSectors.length === 1 ? 'drive' : 'drives'} with reallocated sectors</SectionLabel>
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Sectors']} labelStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="sectors" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {withSectors.map(d => (
          <DriveRow key={d.serial} drive={d}>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--wt-n-200)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (d.reallocated_sectors / maxSectors) * 100)}%`, background: 'var(--wt-warn-500)' }} />
              </div>
              <span className="wt-mono text-xs font-bold w-12 text-right shrink-0"
                style={{ color: 'var(--wt-warn-600)' }}>{d.reallocated_sectors} sec</span>
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
          <StatPill label="Clean" value={clean.length} color="var(--wt-up-600)" />
          <StatPill label="Passed w/ errors" value={withErrors.length} color="var(--wt-warn-500)" />
        </div>
        {withErrors.length > 0 && (
          <>
            <SectionLabel>Passed SMART but have errors</SectionLabel>
            {withErrors.map(d => (
              <DriveRow key={d.serial} drive={d}>
                <div className="flex gap-2">
                  {(d.reallocated_sectors ?? 0) > 0 && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-warn-50)', color: 'var(--wt-warn-600)' }}>
                      {d.reallocated_sectors} realloc
                    </span>
                  )}
                  {(d.pending_sectors ?? 0) > 0 && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-warn-50)', color: 'var(--wt-warn-600)' }}>
                      {d.pending_sectors} pending
                    </span>
                  )}
                  {(d.uncorrectable_errors ?? 0) > 0 && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-warn-50)', color: 'var(--wt-warn-600)' }}>
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
          <div key={d.serial} className="flex items-center justify-between py-1.5 last:border-0"
            style={{ borderBottom: '1px solid var(--wt-border)' }}>
            <span className="wt-mono text-xs truncate" style={{ color: 'var(--wt-text)' }}>{d.serial}</span>
            <span className="text-[10px] ml-2 shrink-0" style={{ color: 'var(--wt-up-600)' }}>PASSED</span>
          </div>
        ))}
      </>
    )
  }

  // ── Average temperature ──────────────────────────────────────────────────────
  if (widgetId === 'avg_temp') {
    const withTemp = drives.filter(d => d.temperature_c != null)
    if (!withTemp.length) return <EmptyState message="No temperature data available." />

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
          <StatPill label="Average" value={`${avg}°C`} color="var(--bw-ink)" />
          <StatPill label="Monitored" value={withTemp.length} />
        </div>
        <SectionLabel>Temperature distribution</SectionLabel>
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="temp" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
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
      { key: 'replace_now',  label: 'Replace Immediately',   dotColor: 'var(--wt-down-500)',  badgeStyle: { background: 'var(--wt-down-50)',  borderColor: 'var(--wt-down-100)',  color: 'var(--wt-down-500)' } },
      { key: 'replace_soon', label: 'Replace When Possible', dotColor: 'var(--wt-warn-600)',  badgeStyle: { background: 'var(--wt-warn-50)',  borderColor: 'var(--wt-warn-200)',  color: 'var(--wt-warn-600)' } },
      { key: 'monitor',      label: 'Monitor Closely',       dotColor: 'var(--wt-warn-500)',  badgeStyle: { background: 'var(--wt-warn-50)',  borderColor: 'var(--wt-warn-100)',  color: 'var(--wt-warn-500)' } },
      { key: 'healthy',      label: 'Healthy',               dotColor: 'var(--wt-up-500)',    badgeStyle: { background: 'var(--wt-up-50)',    borderColor: 'var(--wt-up-100)',    color: 'var(--wt-up-600)' } },
    ]

    const grouped = {}
    for (const t of TIERS) grouped[t.key] = []
    for (const d of drives) grouped[classifyDrive(d)].push(d)

    return (
      <>
        <div className="flex gap-2 mb-5">
          {TIERS.map(t => (
            <div key={t.key} className="flex-1 rounded-xl border px-2 py-2.5 text-center"
              style={t.badgeStyle}>
              <p className="wt-mono text-xl font-bold leading-none">{grouped[t.key].length}</p>
              <p className="text-[8px] mt-1 leading-tight opacity-80">{t.label}</p>
            </div>
          ))}
        </div>

        {TIERS.filter(t => grouped[t.key].length > 0).map(tier => (
          <div key={tier.key} className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5 mt-2 first:mt-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tier.dotColor }} />
              <p className="wt-eyebrow">{tier.label} — {grouped[tier.key].length}</p>
            </div>
            {grouped[tier.key].map(d => (
              <DriveRow key={d.serial} drive={d}>
                <div className="flex flex-wrap gap-1.5">
                  {d.smart_status === 'FAILED' && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-down-50)', color: 'var(--wt-down-500)' }}>SMART FAILED</span>
                  )}
                  {(d.reallocated_sectors ?? 0) > 0 && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-warn-50)', color: 'var(--wt-warn-600)' }}>{d.reallocated_sectors} realloc</span>
                  )}
                  {(d.pending_sectors ?? 0) > 0 && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-warn-50)', color: 'var(--wt-warn-600)' }}>{d.pending_sectors} pending</span>
                  )}
                  {(d.uncorrectable_errors ?? 0) > 0 && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-warn-50)', color: 'var(--wt-warn-600)' }}>{d.uncorrectable_errors} uncorr</span>
                  )}
                  {tier.key === 'monitor' && (d.reallocated_sectors ?? 0) === 0 && (d.pending_sectors ?? 0) === 0 && (d.uncorrectable_errors ?? 0) === 0 && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-surface-2)', color: 'var(--wt-text-muted)' }}>
                      {d.smart_status === 'PASSED'
                        ? `${((d.power_on_hours ?? 0) / 24 / 365).toFixed(1)}y old`
                        : 'No SMART data'}
                    </span>
                  )}
                  {tier.key === 'healthy' && (
                    <span className="text-[10px] rounded px-1.5 py-0.5"
                      style={{ background: 'var(--wt-up-50)', color: 'var(--wt-up-600)' }}>PASSED</span>
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
          <StatPill label="SSDs" value={ssds.length} color="var(--wt-viz-5)" />
          <StatPill label="HDDs" value={hdds.length} />
          <StatPill label="Total" value={tb >= 1 ? `${tb.toFixed(1)} TB` : `${(totalCap / 1e9).toFixed(0)} GB`} color="var(--wt-brand-500)" />
        </div>
        <SectionLabel>By form factor</SectionLabel>
        <div className="flex flex-col gap-1.5 mb-4">
          {ffData.map(({ name, value }) => (
            <div key={name} className="flex items-center gap-2">
              <span className="text-xs w-20 shrink-0" style={{ color: 'var(--wt-text-muted)' }}>{name}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--wt-n-200)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(value / drives.length) * 100}%`, background: 'var(--wt-brand-500)' }} />
              </div>
              <span className="wt-mono text-xs font-semibold w-6 text-right" style={{ color: 'var(--wt-text)' }}>{value}</span>
            </div>
          ))}
        </div>
        {other.length > 0 && (
          <>
            <SectionLabel>{other.length} drives with unknown type</SectionLabel>
            {other.map(d => (
              <div key={d.serial} className="flex items-center justify-between py-1.5 last:border-0"
                style={{ borderBottom: '1px solid var(--wt-border)' }}>
                <span className="text-xs truncate" style={{ color: 'var(--wt-text)' }}>{d.model || d.serial}</span>
                <span className="wt-mono text-[10px] ml-2 shrink-0" style={{ color: 'var(--wt-text-faint)' }}>{d.serial.slice(-6)}</span>
              </div>
            ))}
          </>
        )}
      </>
    )
  }

  return null
}

export default function WidgetDetailModal({ widgetId, drives, profiles, onClose }) {
  const def = WIDGET_DEFS[widgetId]
  if (!def) return null
  const Icon = def.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>

        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--wt-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--wt-surface-2)', color: def.colorVar }}>
              <Icon size={14} />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>{def.label}</h2>
          </div>
          <button onClick={onClose}
            className="transition-colors p-1.5 rounded-lg hover:bg-[var(--wt-surface-2)] text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <DetailContent widgetId={widgetId} drives={drives} profiles={profiles} />
        </div>
      </div>
    </div>
  )
}
