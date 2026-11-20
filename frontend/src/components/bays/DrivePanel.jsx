import { Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight } from 'lucide-react'
import { getDriveHistory } from '../../api/client'
import { computeHealthScore, scoreLabel } from '../../lib/health'
import { bayLabel, counterDelta, isSpare, tempTrend } from '../../lib/fleet'
import { driveKind, driveName, fmtCap, fmtInt, fmtIO, fmtShortDate, formFactorLabel } from '../../lib/format'
import { useTempThresholds } from '../../context/TempThresholdContext'
import { HealthRing, Sparkline, StatusPill } from '../ui/bits'
import { HealthBreakdownModal } from '../../lazy'

/** 30-day history for a drive (local only). */
export function useDriveHistory(serial, days = 30) {
  const [state, setState] = useState({ serial: null, history: [] })
  useEffect(() => {
    if (!serial) return
    let alive = true
    getDriveHistory(serial, days)
      .then(h => { if (alive) setState({ serial, history: h }) })
      .catch(() => { if (alive) setState({ serial, history: [] }) })
    return () => { alive = false }
  }, [serial, days])
  return state.serial === serial ? state.history : []
}

export function errorSummary(d) {
  const parts = []
  if (d.smart_status === 'FAILED') parts.push('SMART failed')
  if (d.reallocated_sectors) parts.push(`${d.reallocated_sectors} reallocated`)
  if (d.pending_sectors) parts.push(`${d.pending_sectors} pending`)
  if (d.uncorrectable_errors) parts.push(`${d.uncorrectable_errors} uncorrectable`)
  const zfs = (d.zfs_read_errors || 0) + (d.zfs_write_errors || 0) + (d.zfs_checksum_errors || 0)
  if (zfs) parts.push(`${zfs} ZFS errors`)
  return parts
}

export function DriveTags({ drive }) {
  const tags = [fmtCap(drive.capacity_bytes), driveKind(drive), formFactorLabel(drive.form_factor)].filter(t => t && t !== '—')
  return (
    <div className="bw-tags">
      {tags.map(t => <span key={t} className="wt-chip wt-chip--plain">{t}</span>)}
      {drive.device_path && <span className="wt-chip wt-chip--plain">{drive.device_path}</span>}
    </div>
  )
}

/** Health ring + grade + SMART line. */
export function HealthBlock({ drive, history, size = 84 }) {
  const { warnC, dangerC } = useTempThresholds()
  const [open, setOpen] = useState(false)
  const { score, breakdown } = computeHealthScore(drive, history, null, warnC, dangerC)
  const { label } = scoreLabel(score)
  const errs = errorSummary(drive)
  return (
    <div className="flex items-center gap-4">
      <HealthRing score={score} size={size} onClick={breakdown.length ? () => setOpen(true) : undefined} />
      <div className="min-w-0">
        <div className="font-bold" style={{ fontSize: 'var(--wt-text-lg)', letterSpacing: '-0.02em' }}>{label}</div>
        <div className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>Health score</div>
        {drive.is_connected === false ? (
          <span className="wt-pill wt-pill--muted mt-2">Offline, last known values</span>
        ) : errs.length ? (
          <span className={`wt-pill ${drive.smart_status === 'FAILED' ? 'wt-pill--solid-down' : 'wt-pill--warn'} mt-2`}>
            <AlertTriangle size={12} aria-hidden="true" />{errs.join(', ')}
          </span>
        ) : (
          <span className="wt-pill wt-pill--up mt-2"><Check size={12} aria-hidden="true" />No SMART errors</span>
        )}
      </div>
      {open && (
        <Suspense fallback={null}>
          <HealthBreakdownModal drive={drive} score={score} breakdown={breakdown} history={history} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export function DriveStats({ drive, history }) {
  const read = counterDelta(history, 'read_bytes')
  const written = counterDelta(history, 'write_bytes')
  const cells = [
    ['Temperature', drive.temperature_c != null ? <>{drive.temperature_c}<small>°C</small></> : '—'],
    ['Power-on', drive.power_on_hours != null ? <>{fmtInt(drive.power_on_hours)}<small>h</small></> : '—'],
    ['Read, 30 days', fmtIO(read)],
    ['Written, 30 days', fmtIO(written)],
  ]
  return (
    <div className="bw-quad">
      {cells.map(([k, v]) => (
        <div key={k} className="bw-stat">
          <div className="bw-stat__label">{k}</div>
          <div className="bw-metric bw-stat__value">{v}</div>
        </div>
      ))}
    </div>
  )
}

export function TempHistory({ history }) {
  const { warnC } = useTempThresholds()
  const temps = history.map(h => h.temperature_c)
  const trend = tempTrend(history)
  const first = history[0]?.recorded_at, last = history[history.length - 1]?.recorded_at
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-2">
        <span className="font-bold">Temperature, 30 days</span>
        {trend && <span style={{ color: 'var(--wt-text-muted)' }}>{trend}</span>}
      </div>
      <Sparkline values={temps} height={80} color="var(--wt-viz-1)" refLine={warnC}
        label={`Temperature over 30 days${trend ? `, ${trend.toLowerCase()}` : ''}. Dashed line is the ${warnC}°C warning threshold.`} />
      {first && (
        <div className="flex justify-between wt-mono text-[11px] mt-1" style={{ color: 'var(--wt-text-subtle)' }}>
          <span>{fmtShortDate(first)}</span><span>{fmtShortDate(last)}</span>
        </div>
      )}
    </div>
  )
}

/** Desktop right-column panel for the selected bay. */
export default function DrivePanel({ drive, bay, location, onEdit, onHistory, remote }) {
  const history = useDriveHistory(remote ? null : drive?.serial)
  if (!drive) {
    return (
      <aside aria-label="Selected drive" className="bw-card bw-card--pad">
        <span className="wt-eyebrow">Selected drive</span>
        <p className="bw-sub mt-3">Choose a bay to see its drive here.</p>
      </aside>
    )
  }
  const spare = isSpare(drive, bay)
  return (
    <aside aria-label="Selected drive" className="bw-card" data-screen-label="Selected drive">
      <div className="bw-drivehead">
        <div className="flex justify-between items-center gap-2">
          <span className="wt-eyebrow">{location?.name}{bay ? ` · Bay ${bayLabel(bay)}` : ''}</span>
          <span className="flex gap-1.5">
            {spare && <span className="wt-chip wt-chip--plain">Spare</span>}
            <StatusPill drive={drive} />
          </span>
        </div>
        <div className="font-bold mt-3" style={{ fontSize: 'var(--wt-text-xl)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{driveName(drive)}</div>
        <div className="wt-mono text-[13px] mt-1" style={{ color: 'var(--wt-text-muted)' }}>{drive.serial}</div>
        <div className="mt-3"><DriveTags drive={drive} /></div>
      </div>
      <div className="p-6 flex flex-col gap-5">
        <HealthBlock drive={drive} history={history} />
        <DriveStats drive={drive} history={history} />
        {!remote && <TempHistory history={history} />}
        {!remote && (
          <div className="flex gap-2.5">
            <button type="button" className="wt-btn wt-btn--secondary bw-btn-lg flex-1 justify-center" onClick={onHistory}>History</button>
            <button type="button" className="wt-btn wt-btn--primary bw-btn-lg justify-center" style={{ flex: 1.5 }} onClick={onEdit}>Edit bay and drive</button>
          </div>
        )}
        {!remote && (
          <Link to={`/drives/${encodeURIComponent(drive.serial)}`} className="inline-flex items-center gap-1 text-[13px] font-semibold self-start" style={{ color: 'var(--bw-ink)' }}>
            All drive details <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
    </aside>
  )
}
