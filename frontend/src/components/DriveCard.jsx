import { useEffect, useState } from 'react'
import { Clock, X, Pencil, Trash2, AlertTriangle, Zap, Archive, ArrowLeftRight, CheckCircle2, ShieldAlert, WifiOff, History } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts'
import WarningBadge from './WarningBadge'
import DriveHistoryModal from './DriveHistoryModal'
import HealthBreakdownModal from './HealthBreakdownModal'
import { getDriveIcon } from '../utils/driveIcon'
import { useTempThresholds } from '../context/TempThresholdContext'
import { getDriveHistory, getDrivePartitions } from '../api/client'

const BAY_STATUS_INFO = {
  damaged:    { label: 'Damaged',    icon: AlertTriangle,
    colorStyle: { color: 'var(--wt-warn-600)' },
    bgStyle: { background: 'var(--wt-warn-50)', borderColor: 'var(--wt-warn-200)' } },
  hot_spare:  { label: 'Hot Spare',  icon: Zap,
    colorStyle: { color: 'var(--bw-ink)' },
    bgStyle: { background: 'color-mix(in oklch, var(--bw-ink) 8%, transparent)', borderColor: 'color-mix(in oklch, var(--bw-ink) 25%, transparent)' } },
  cold_spare: { label: 'Cold Spare', icon: Archive,
    colorStyle: { color: 'var(--wt-text-muted)' },
    bgStyle: { background: 'var(--wt-surface-2)', borderColor: 'var(--wt-border)' } },
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  return `${(bytes / 1e9).toFixed(0)} GB`
}
function formatWarrantyYears(months) {
  if (!months) return '—'
  return `${parseFloat((months / 12).toFixed(1))} yrs`
}
function formatExpiry(expiryDate, daysRemaining) {
  if (!expiryDate) return '—'
  const dateStr = new Date(expiryDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  if (daysRemaining == null) return dateStr
  if (daysRemaining > 0) return `${dateStr} · ${parseFloat((daysRemaining / 365).toFixed(1))}y left`
  return `${dateStr} · ${Math.abs(Math.round(daysRemaining / 30))}mo ago`
}
function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

const FSTYPE_COLORS = {
  zfs_member: '#3b82f6',
  ext4: '#22c55e', ext3: '#22c55e', ext2: '#22c55e', ext: '#22c55e',
  btrfs: '#14b8a6', xfs: '#8b5cf6', swap: '#f59e0b',
  ntfs: '#f97316', vfat: '#f97316', exfat: '#f97316', fat32: '#f97316', fat16: '#f97316',
  reiserfs: '#06b6d4', reiser4: '#06b6d4', lvm2_member: '#ec4899',
  linux_raid_member: '#ef4444', crypto_luks: '#a855f7',
  apfs: '#6366f1', hfsplus: '#6366f1', hfs: '#6366f1',
  nilfs2: '#0ea5e9', udf: '#84cc16', iso9660: '#84cc16',
  squashfs: '#78716c', tmpfs: '#94a3b8',
}
const FSTYPE_LABELS = {
  zfs_member: 'ZFS', lvm2_member: 'LVM', linux_raid_member: 'RAID',
  crypto_luks: 'LUKS', hfsplus: 'HFS+', hfs: 'HFS', fat32: 'FAT32', fat16: 'FAT16',
}
const MIN_CHART_BYTES = 1_048_576

function fstypeColor(fstype) { return FSTYPE_COLORS[fstype?.toLowerCase()] ?? '#64748b' }
function fstypeLabel(fstype) {
  if (!fstype) return 'unknown'
  return FSTYPE_LABELS[fstype.toLowerCase()] ?? fstype
}

function healthState(drive) {
  if (drive.smart_status === 'FAILED') return 'failed'
  if (drive.smart_status === 'PASSED') {
    const hasErrors = (drive.reallocated_sectors ?? 0) > 0
      || (drive.pending_sectors ?? 0) > 0
      || (drive.uncorrectable_errors ?? 0) > 0
    return hasErrors ? 'warn' : 'ok'
  }
  return 'unknown'
}
function healthGradient(state) {
  if (state === 'ok')     return { background: 'linear-gradient(to bottom, var(--wt-up-50), var(--wt-surface))',   borderColor: 'var(--wt-up-100)' }
  if (state === 'warn')   return { background: 'linear-gradient(to bottom, var(--wt-warn-50), var(--wt-surface))', borderColor: 'var(--wt-warn-200)' }
  if (state === 'failed') return { background: 'linear-gradient(to bottom, var(--wt-down-50), var(--wt-surface))', borderColor: 'var(--wt-down-200)' }
  return { background: 'linear-gradient(to bottom, var(--wt-surface-2), var(--wt-surface))', borderColor: 'var(--wt-border)' }
}
function iconStyle(state) {
  if (state === 'failed') return {
    wrap: { background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)' },
    icon: { color: 'var(--wt-down-500)' },
  }
  if (state === 'warn') return {
    wrap: { background: 'var(--wt-warn-50)', border: '1px solid var(--wt-warn-100)' },
    icon: { color: 'var(--wt-warn-600)' },
  }
  return {
    wrap: { background: 'var(--wt-surface-2)', border: '1px solid var(--wt-border)' },
    icon: { color: 'var(--wt-brand-500)' },
  }
}

// Expected lifetime I/O in bytes by drive type
const IO_CURVES = {
  consumer_hdd:    { read: 150e12,  write: 75e12   },
  nas_hdd:         { read: 500e12,  write: 200e12  },
  enterprise_hdd:  { read: 2000e12, write: 1000e12 },
  consumer_ssd:    { read: 150e12,  write: 60e12   },
  enterprise_ssd:  { read: 1000e12, write: 500e12  },
  nvme_consumer:   { read: 200e12,  write: 80e12   },
  nvme_enterprise: { read: 1000e12, write: 500e12  },
  optane:          { read: 5000e12, write: 5000e12 },
}

// Drive-type-aware age curves { warn, max } in power-on hours
const AGE_CURVES = {
  consumer_hdd:    { warn: 30000, max: 50000, label: 'Consumer HDD' },
  nas_hdd:         { warn: 40000, max: 60000, label: 'NAS HDD' },
  enterprise_hdd:  { warn: 55000, max: 80000, label: 'Enterprise HDD' },
  consumer_ssd:    { warn: 30000, max: 50000, label: 'Consumer SSD' },
  enterprise_ssd:  { warn: 50000, max: 70000, label: 'Enterprise SSD' },
  nvme_consumer:   { warn: 30000, max: 50000, label: 'NVMe consumer' },
  nvme_enterprise: { warn: 50000, max: 70000, label: 'NVMe enterprise' },
  optane:          { warn: 70000, max: 100000, label: 'Optane' },
}

function inferDriveType(drive) {
  if (drive.rpm === 0) {
    if (drive.form_factor === 'M.2' || drive.form_factor === 'U.2') return 'nvme_consumer'
    return 'consumer_ssd'
  }
  if (drive.rpm != null && drive.rpm > 0) {
    if (/exos|ultrastar|gold|datacenter|enterprise|mc\d|mg\d|dc\s/i.test(drive.model || '') ||
        (drive.rpm >= 7200 && (drive.capacity_bytes || 0) >= 8e12)) return 'enterprise_hdd'
    if (/red|ironwolf|nas|surveillance/i.test(drive.model || '')) return 'nas_hdd'
    return 'consumer_hdd'
  }
  return 'consumer_hdd'
}

// Composite health score 0–100 with per-factor breakdown
// Returns { score: number|null, breakdown: Array<{factor, detail, delta, positive?}> }
function computeHealthScore(drive, history = [], ratedTbw = null, warnC = 55, dangerC = 65) {
  if (!drive.smart_status || drive.smart_status === 'UNKNOWN') return { score: null, breakdown: [] }
  if (drive.smart_status === 'FAILED') return { score: 0, breakdown: [{ factor: 'SMART failure', detail: 'FAILED status', delta: -100 }] }

  let score = 100
  const breakdown = []

  breakdown.push({ factor: 'SMART status', detail: 'PASSED', delta: 0, positive: true })

  const realloc = drive.reallocated_sectors ?? 0
  if (realloc > 0) {
    const d = -Math.min(40, realloc * 4)
    score += d; breakdown.push({ factor: 'Reallocated sectors', detail: String(realloc), delta: d })
  }
  const pending = drive.pending_sectors ?? 0
  if (pending > 0) {
    const d = -Math.min(25, pending * 5)
    score += d; breakdown.push({ factor: 'Pending sectors', detail: String(pending), delta: d })
  }
  const uncorr = drive.uncorrectable_errors ?? 0
  if (uncorr > 0) {
    const d = -Math.min(35, uncorr * 10)
    score += d; breakdown.push({ factor: 'Uncorrectable errors', detail: String(uncorr), delta: d })
  }

  // Drive-type-aware age penalty — two-phase curve
  // Phase 1: 50% of warn → warn: 0 to -10 (light)
  // Phase 2: warn → max: -10 to -40 (steep)
  const poh = drive.power_on_hours ?? 0
  const driveType = drive.drive_type || inferDriveType(drive)
  const ac = AGE_CURVES[driveType] || AGE_CURVES.consumer_hdd
  const earlyWarn = ac.warn * 0.5
  if (poh >= earlyWarn) {
    let d
    if (poh < ac.warn) {
      d = -Math.round(((poh - earlyWarn) / Math.max(1, ac.warn - earlyWarn)) * 10)
    } else {
      const phase2 = -Math.round(((poh - ac.warn) / Math.max(1, ac.max - ac.warn)) * 30)
      d = Math.max(-40, -10 + phase2)
    }
    if (d < 0) {
      score += d
      breakdown.push({ factor: 'Drive age', detail: `${poh.toLocaleString()} hrs (${ac.label})`, delta: d })
    } else {
      breakdown.push({ factor: 'Drive age', detail: `${poh.toLocaleString()} hrs — within range`, delta: 0, positive: true })
    }
  } else {
    breakdown.push({ factor: 'Drive age', detail: `${poh.toLocaleString()} hrs — within range`, delta: 0, positive: true })
  }

  // Heat exposure across all available history (not just current temp)
  const tempReadings = history.filter(h => h.temperature_c != null)
  if (tempReadings.length >= 3) {
    const aboveDanger = tempReadings.filter(h => h.temperature_c >= dangerC).length
    const aboveWarn   = tempReadings.filter(h => h.temperature_c >= warnC && h.temperature_c < dangerC).length
    const pctDanger = aboveDanger / tempReadings.length
    const pctWarn   = aboveWarn   / tempReadings.length
    const d = Math.round(-(pctDanger * 20 + pctWarn * 10))
    if (d < 0) {
      score += d
      breakdown.push({ factor: 'Heat exposure', detail: `${Math.round((pctDanger + pctWarn) * 100)}% of ${tempReadings.length} readings ≥${warnC}°C`, delta: d })
    } else {
      breakdown.push({ factor: 'Heat exposure', detail: `${tempReadings.length} readings all within range`, delta: 0, positive: true })
    }
  } else if (drive.temperature_c != null) {
    const temp = drive.temperature_c
    const d = temp >= dangerC ? -10 : temp >= warnC ? -5 : 0
    if (d < 0) { score += d; breakdown.push({ factor: 'Temperature (current)', detail: `${temp}°C`, delta: d }) }
  }

  // TBW endurance (SSD types only, requires rated_tbw from profile)
  const isSsd = ['consumer_ssd', 'enterprise_ssd', 'nvme_consumer', 'nvme_enterprise', 'optane'].includes(driveType)
  if (isSsd && ratedTbw) {
    const latest = [...history].reverse().find(h => h.write_bytes != null)
    if (latest) {
      const writtenTb = latest.write_bytes / 1e12
      const pctUsed = writtenTb / ratedTbw
      if (pctUsed > 0.5) {
        const d = Math.max(-20, -Math.round((pctUsed - 0.5) * 40))
        score += d
        breakdown.push({ factor: 'TBW endurance', detail: `${writtenTb.toFixed(1)} TB written / ${ratedTbw} TB rated (${Math.round(pctUsed * 100)}%)`, delta: d })
      } else {
        breakdown.push({ factor: 'TBW endurance', detail: `${writtenTb.toFixed(1)} TB written / ${ratedTbw} TB rated`, delta: 0, positive: true })
      }
    }
  }

  return { score: Math.max(0, Math.round(score)), breakdown }
}
function scoreLabel(score) {
  if (score == null) return { label: 'Unknown',  color: 'var(--wt-text-faint)' }
  if (score >= 90)   return { label: 'Excellent', color: 'var(--wt-up-600)' }
  if (score >= 75)   return { label: 'Good',      color: 'var(--wt-up-500)' }
  if (score >= 60)   return { label: 'Fair',      color: 'var(--wt-warn-600)' }
  if (score >= 40)   return { label: 'Poor',      color: 'var(--wt-warn-500)' }
  return               { label: 'Critical',   color: 'var(--wt-down-500)' }
}

function HealthRing({ score, onClick }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const fill = score == null ? 0 : (score / 100) * circ
  const { label, color } = scoreLabel(score)
  return (
    <div
      className={`flex items-center gap-3 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={onClick}
      title={onClick ? 'Click to see score breakdown' : undefined}
    >
      <div className="relative w-[52px] h-[52px] shrink-0">
        <svg width={52} height={52} className="-rotate-90">
          <circle cx={26} cy={26} r={r} fill="none"
            style={{ stroke: 'var(--wt-n-200)', strokeWidth: 4 }} />
          <circle cx={26} cy={26} r={r} fill="none"
            style={{ stroke: color, strokeWidth: 4, strokeDasharray: `${fill} ${circ - fill}`, strokeLinecap: 'round', transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="wt-mono text-xs font-bold" style={{ color }}>
            {score == null ? '?' : score}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight" style={{ color }}>{label}</p>
        <p className="wt-eyebrow leading-snug" style={{ color: 'var(--wt-text-muted)' }}>Health Score</p>
        <p className="text-[9px] leading-snug mt-0.5" style={{ color: 'var(--wt-text-faint)' }}>
          {onClick ? 'click for breakdown' : 'SMART · age · temp'}
        </p>
      </div>
    </div>
  )
}

export default function DriveCard({ drive, profile, bay, poolStats = [], onClose, onEdit, onReassign, onDelete, remote = false, instanceName = null, remoteHistory = null, remoteHistoryError = null }) {
  const { warnC, dangerC } = useTempThresholds()
  const [history, setHistory] = useState([])
  const [partitions, setPartitions] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)

  useEffect(() => {
    if (!drive) return
    if (remote) {
      if (remoteHistory !== null) setHistory(remoteHistory)
      return
    }
    setHistory([])
    setPartitions([])
    getDriveHistory(drive.serial, 90).then(setHistory).catch(() => {})
    getDrivePartitions(drive.serial).then(setPartitions).catch(() => {})
  }, [drive?.serial, remote, remoteHistory])

  if (!drive) return null

  const warrantyDays = profile?.warranty_days_remaining ?? null
  const DriveIcon = getDriveIcon(drive.form_factor, drive.rpm)
  const poolInfo = drive.zfs_pool ? poolStats.find(p => p.name === drive.zfs_pool) : null
  const bayStatusInfo = bay?.status ? BAY_STATUS_INFO[bay.status] : null
  const state = healthState(drive)
  const { wrap: iconWrap, icon: iconCls } = iconStyle(state)
  const ratedTbw = profile?.rated_tbw ?? null
  const { score: healthScore, breakdown: healthBreakdown } = computeHealthScore(drive, history, ratedTbw, warnC, dangerC)

  const tempHistory = history
    .filter(h => h.temperature_c != null)
    .map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      temp: h.temperature_c,
    }))

  const spaceHistory = history
    .filter(h => h.used_bytes != null)
    .map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      usedGB: parseFloat((h.used_bytes / 1e9).toFixed(2)),
    }))

  const reallocHistory = history
    .filter(h => h.reallocated_sectors != null)
    .map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sectors: h.reallocated_sectors,
    }))
  const hasReallocHistory = reallocHistory.some(h => h.sectors > 0)

  // I/O deltas: consecutive cumulative bytes → MB transferred per scan interval
  const ioHistory = (() => {
    const pts = history.filter(h => h.read_bytes != null)
    if (pts.length < 2) return []
    const result = []
    for (let i = 1; i < pts.length; i++) {
      const dr = pts[i].read_bytes - pts[i - 1].read_bytes
      const dw = pts[i].write_bytes - pts[i - 1].write_bytes
      if (dr < 0 || dw < 0) continue  // counter reset after reboot
      result.push({
        date: new Date(pts[i].recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        readMB:  Math.round(dr / 1048576),
        writeMB: Math.round(dw / 1048576),
      })
    }
    return result
  })()

  const ioMaxMB = ioHistory.length ? Math.max(...ioHistory.map(h => Math.max(h.readMB, h.writeMB))) : 0
  const ioUnit = ioMaxMB >= 1000 ? 'GB' : 'MB'
  const ioData = ioUnit === 'GB'
    ? ioHistory.map(h => ({ ...h, readMB: +(h.readMB / 1024).toFixed(2), writeMB: +(h.writeMB / 1024).toFixed(2) }))
    : ioHistory

  const hasErrors = (drive.reallocated_sectors ?? 0) > 0
    || (drive.pending_sectors ?? 0) > 0
    || (drive.uncorrectable_errors ?? 0) > 0

  // Lifetime I/O from latest history record (cumulative SMART/kernel counters)
  const latestWithIO = [...history].reverse().find(h => h.read_bytes != null || h.write_bytes != null)
  const lifetimeReadBytes  = latestWithIO?.read_bytes  ?? null
  const lifetimeWriteBytes = latestWithIO?.write_bytes ?? null

  // Drive-type-aware I/O scale for lifetime bars
  const ioCurve = IO_CURVES[drive.drive_type || inferDriveType(drive)] || IO_CURVES.consumer_hdd
  const isSsdForIO = ['consumer_ssd', 'enterprise_ssd', 'nvme_consumer', 'nvme_enterprise', 'optane'].includes(drive.drive_type || inferDriveType(drive))
  const ioMaxRead  = ioCurve.read
  const ioMaxWrite = (isSsdForIO && ratedTbw) ? ratedTbw * 1e12 : ioCurve.write

  // Clamp temp chart domain to [25, 65] but expand if actual values are outside
  const tempMin = tempHistory.length ? Math.min(...tempHistory.map(h => h.temp)) : 25
  const tempMax = tempHistory.length ? Math.max(...tempHistory.map(h => h.temp)) : 65
  const tempDomainLow  = Math.min(25, tempMin - 2)
  const tempDomainHigh = Math.max(65, tempMax + 2)

  const tooltipStyle = {
    fontSize: 10, padding: '4px 8px', borderRadius: 6,
    border: 'none', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0',
  }
  const axisStyle = { fontSize: 8, fill: 'var(--wt-text-faint)' }

  return (
    <div className="flex flex-col gap-0 rounded-2xl border overflow-hidden shadow-xl" style={healthGradient(state)}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={iconWrap}>
            <DriveIcon size={18} style={iconCls} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate" style={{ color: 'var(--wt-text)' }}>
              {drive.make || 'Unknown Make'}
            </p>
            <p className="text-xs leading-snug truncate" style={{ color: 'var(--wt-text-muted)' }}>{drive.model || 'Unknown Model'}</p>
            <p className="wt-mono text-[10px] leading-snug" style={{ color: 'var(--wt-text-faint)' }}>{drive.serial}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
          {remote && instanceName && (
            <span className="wt-eyebrow px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--wt-brand-50)', color: 'var(--wt-brand-600)', border: '1px solid var(--wt-brand-200)' }}>
              {instanceName}
            </span>
          )}
          <WarningBadge status={drive.smart_status} days={warrantyDays} />
          {onReassign && (
            <button onClick={onReassign} className="transition-colors p-0.5 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-warn-500)]" title="Reassign bay">
              <ArrowLeftRight size={14} />
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="transition-colors p-0.5 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-brand-500)]" title="Edit drive">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => setConfirmDelete(true)} className="transition-colors p-0.5 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-down-500)]" title="Delete drive">
              <Trash2 size={14} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="transition-colors p-0.5 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="mx-4 mb-1 rounded-lg border px-3 py-2.5 flex items-center gap-3"
          style={{ background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
          <p className="text-xs flex-1" style={{ color: 'var(--wt-down-700)' }}>Permanently delete this drive?</p>
          <button
            onClick={() => { onDelete(drive.serial); setConfirmDelete(false) }}
            className="wt-btn wt-btn--danger wt-btn--sm"
          >Delete</button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="wt-btn wt-btn--secondary wt-btn--sm"
          >Cancel</button>
        </div>
      )}

      {/* ── Disconnected banner ── */}
      {drive.is_connected === false && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2.5 border"
          style={{ background: 'var(--wt-warn-50)', borderColor: 'var(--wt-warn-200)' }}>
          <WifiOff size={14} className="shrink-0" style={{ color: 'var(--wt-warn-600)' }} />
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--wt-warn-700)' }}>Drive not detected</p>
            {drive.last_scanned && (
              <p className="text-[10px] leading-snug" style={{ color: 'var(--wt-warn-600)' }}>
                Last seen {new Date(drive.last_scanned).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Spec chips ── */}
      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {drive.capacity_bytes && <Chip>{formatBytes(drive.capacity_bytes)}</Chip>}
        {drive.rpm === 0
          ? <Chip>SSD</Chip>
          : drive.rpm ? <Chip>HDD {drive.rpm.toLocaleString()} rpm</Chip> : null}
        {drive.form_factor && <Chip>{drive.form_factor}</Chip>}
        {drive.firmware_version && <Chip mono>FW {drive.firmware_version}</Chip>}
        {drive.device_path && <Chip mono>{drive.device_path}</Chip>}
      </div>

      {/* ── Health score ring ── */}
      {healthScore !== null && (
        <div className="mx-4 mb-3 rounded-xl border px-3 py-2.5"
          style={{ borderColor: 'var(--wt-border)', background: 'var(--wt-surface-2)' }}>
          <HealthRing score={healthScore} onClick={() => setBreakdownOpen(true)} />
        </div>
      )}

      {/* ── Temperature + Power-on hours ── */}
      {(drive.temperature_c != null || drive.power_on_hours != null) && (
        <div className={`px-4 pb-3 grid gap-3 ${drive.temperature_c != null && drive.power_on_hours != null ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {drive.temperature_c != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="wt-eyebrow">Temp</span>
                <span className="wt-mono text-xs font-bold" style={{ color:
                  drive.temperature_c >= dangerC ? 'var(--wt-down-500)' :
                  drive.temperature_c >= warnC   ? 'var(--wt-warn-600)' :
                  'var(--wt-brand-500)'
                }}>{drive.temperature_c}°C</span>
              </div>
              <div className="wt-meter">
                <div className="wt-meter__fill wt-meter__fill--temp"
                  style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }} />
              </div>
            </div>
          )}
          {drive.power_on_hours != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="wt-eyebrow">Hours</span>
                <span className="wt-mono text-xs font-bold" style={{ color: 'var(--wt-text-muted)' }}>{drive.power_on_hours.toLocaleString()}h</span>
              </div>
              <div className="wt-meter">
                <div className="wt-meter__fill" style={{
                  width: `${Math.min(100, (drive.power_on_hours / 50000) * 100)}%`,
                  background: drive.power_on_hours >= 40000 ? 'var(--wt-down-500)' :
                              drive.power_on_hours >= 25000 ? 'var(--wt-warn-500)' :
                              'var(--wt-brand-500)',
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Remote history error banner ── */}
      {remote && remoteHistoryError && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 border"
          style={{ background: 'var(--wt-warn-50)', borderColor: 'var(--wt-warn-200)' }}>
          <AlertTriangle size={12} className="shrink-0" style={{ color: 'var(--wt-warn-600)' }} />
          <p className="text-[10px]" style={{ color: 'var(--wt-warn-700)' }}>History unavailable: {remoteHistoryError} — showing last cached data</p>
        </div>
      )}

      {/* ── Lifetime I/O ── */}
      {(lifetimeReadBytes != null || lifetimeWriteBytes != null) && (
        <div className={`px-4 pb-3 grid gap-3 ${lifetimeReadBytes != null && lifetimeWriteBytes != null ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {lifetimeReadBytes != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="wt-eyebrow">Read</span>
                <span className="wt-mono text-xs font-bold" style={{ color: 'var(--wt-up-600)' }}>{formatBytes(lifetimeReadBytes)}</span>
              </div>
              <div className="wt-meter">
                <div className="wt-meter__fill" style={{ width: `${Math.min(100, (lifetimeReadBytes / ioMaxRead) * 100)}%`, background: 'var(--wt-up-500)' }} />
              </div>
            </div>
          )}
          {lifetimeWriteBytes != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="wt-eyebrow">Write</span>
                <span className="wt-mono text-xs font-bold" style={{ color: 'var(--wt-viz-4)' }}>{formatBytes(lifetimeWriteBytes)}</span>
              </div>
              <div className="wt-meter">
                <div className="wt-meter__fill" style={{ width: `${Math.min(100, (lifetimeWriteBytes / ioMaxWrite) * 100)}%`, background: 'var(--wt-viz-4)' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Health block ── */}
      <div className="px-4 pb-3">
        {state === 'failed' || hasErrors ? (
          <div className="flex flex-col gap-2">
            {state === 'failed' && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 border"
                style={{ background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
                <ShieldAlert size={13} className="shrink-0" style={{ color: 'var(--wt-down-500)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--wt-down-600)' }}>SMART failure detected</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Reallocated', value: drive.reallocated_sectors },
                { label: 'Pending',     value: drive.pending_sectors },
                { label: 'Uncorrect.',  value: drive.uncorrectable_errors },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg px-2 py-2 text-center border" style={
                  (value ?? 0) > 0
                    ? { background: 'var(--wt-warn-50)', borderColor: 'var(--wt-warn-200)' }
                    : { background: 'var(--wt-surface-2)', borderColor: 'var(--wt-border)' }
                }>
                  <p className="wt-mono text-sm font-bold leading-none" style={{ color: (value ?? 0) > 0 ? 'var(--wt-warn-600)' : 'var(--wt-text-faint)' }}>
                    {value ?? '—'}
                  </p>
                  <p className="text-[9px] mt-1 leading-none" style={{ color: 'var(--wt-text-faint)' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : drive.smart_status === 'PASSED' ? (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 border"
            style={{ background: 'var(--wt-up-50)', borderColor: 'var(--wt-up-100)' }}>
            <CheckCircle2 size={13} className="shrink-0" style={{ color: 'var(--wt-up-500)' }} />
            <span className="text-xs" style={{ color: 'var(--wt-up-600)' }}>No SMART errors detected</span>
          </div>
        ) : null}
      </div>

      {/* ── Temperature history — gradient area chart, 25–65°C scale ── */}
      {tempHistory.length > 1 && (
        <div className="px-4 pb-3">
          <p className="wt-eyebrow mb-1.5">Temp History (30d)</p>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={tempHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[tempDomainLow, tempDomainHigh]} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}°C`, 'Temp']} labelStyle={{ color: '#94a3b8' }} />
              <ReferenceLine y={warnC}   stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: `${warnC}°`, position: 'right', fontSize: 7, fill: '#f59e0b' }} />
              <ReferenceLine y={dangerC} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: `${dangerC}°`, position: 'right', fontSize: 7, fill: '#ef4444' }} />
              <Area type="monotone" dataKey="temp" stroke="#38bdf8" fill="url(#tempGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Used space trend ── */}
      {spaceHistory.length > 1 && (
        <div className="px-4 pb-3">
          <p className="wt-eyebrow mb-1.5">Used Space (30d)</p>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={spaceHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="spaceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2dd4bf" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} unit=" GB" />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} GB`, 'Used']} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="usedGB" stroke="#2dd4bf" fill="url(#spaceGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Reallocated sectors trend ── */}
      {hasReallocHistory && (
        <div className="px-4 pb-3">
          <p className="wt-eyebrow mb-1.5">Reallocated Sectors (30d)</p>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={reallocHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="reallocGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Sectors']} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="sectors" stroke="#f59e0b" fill="url(#reallocGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── I/O activity chart ── */}
      {ioHistory.length > 0 && (
        <div className="px-4 pb-3">
          <p className="wt-eyebrow mb-0.5">I/O Activity (30d)</p>
          <p className="text-[9px] mb-1.5" style={{ color: 'var(--wt-text-faint)' }}>{ioUnit} per scan interval · this drive</p>
          <div className="flex items-center gap-3 mb-1">
            <span className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--wt-text-faint)' }}><span className="w-2 h-0.5 rounded inline-block" style={{ background: '#34d399' }} />Read</span>
            <span className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--wt-text-faint)' }}><span className="w-2 h-0.5 rounded inline-block" style={{ background: '#a78bfa' }} />Write</span>
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={ioData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="readGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="writeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} unit={` ${ioUnit}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v.toLocaleString()} ${ioUnit}`, n === 'readMB' ? 'Read' : 'Write']} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="readMB"  stroke="#34d399" fill="url(#readGrad)"  strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="writeMB" stroke="#a78bfa" fill="url(#writeGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Partition donut ── */}
      {partitions.length > 0 && (() => {
        const visiblePartitions = partitions.filter(p => (p.size_bytes || 0) >= MIN_CHART_BYTES)
        const usedBytes = visiblePartitions.reduce((s, p) => s + (p.size_bytes || 0), 0)
        const unpartitioned = drive.capacity_bytes ? Math.max(0, drive.capacity_bytes - usedBytes) : 0
        const pieData = [
          ...visiblePartitions.map(p => ({ name: p.label || p.name, fstype: p.fstype, value: p.size_bytes || 0 })),
          ...(unpartitioned > 0 ? [{ name: 'Unpartitioned', fstype: null, value: unpartitioned }] : []),
        ]
        if (!pieData.length) return null
        return (
          <div className="px-4 pb-3">
            <p className="wt-eyebrow mb-2">Partitions</p>
            <div className="flex items-center gap-4">
              <PieChart width={80} height={80}>
                <Pie data={pieData} cx={35} cy={35} innerRadius={22} outerRadius={36} dataKey="value" stroke="none">
                  {pieData.map((entry, i) => <Cell key={i} fill={fstypeColor(entry.fstype)} />)}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: fstypeColor(entry.fstype) }} />
                    <span className="wt-mono text-[10px] truncate" style={{ color: 'var(--wt-text-muted)' }}>{fstypeLabel(entry.fstype)}</span>
                    <span className="wt-mono text-[10px] ml-auto shrink-0" style={{ color: 'var(--wt-text-faint)' }}>{formatSize(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── ZFS pool ── */}
      {drive.zfs_pool && (
        <div className="mx-4 mb-3 rounded-xl border px-3 py-2.5"
          style={{ borderColor: 'var(--wt-brand-200)', background: 'color-mix(in oklch, var(--wt-brand-50) 60%, var(--wt-surface))' }}>
          <p className="wt-eyebrow mb-1.5">ZFS Pool</p>
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="wt-mono text-xs font-semibold truncate" style={{ color: 'var(--wt-brand-600)' }}>{drive.zfs_pool}</span>
            {drive.vdev_name && (
              <span className="wt-mono text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
                style={{ background: 'var(--wt-brand-100)', color: 'var(--wt-brand-600)', border: '1px solid var(--wt-brand-200)' }}>
                {drive.vdev_name}
              </span>
            )}
            {poolInfo && (
              <span className="wt-mono text-[10px] shrink-0" style={{ color: 'var(--wt-text-muted)' }}>{poolInfo.capacity_pct}% used</span>
            )}
          </div>
          {poolInfo && (
            <>
              <div className="wt-meter mb-1">
                <div className="wt-meter__fill" style={{
                  width: `${poolInfo.capacity_pct}%`,
                  background: poolInfo.capacity_pct >= 80 ? 'var(--wt-down-500)' :
                              poolInfo.capacity_pct >= 60 ? 'var(--wt-warn-500)' :
                              'var(--wt-brand-500)',
                }} />
              </div>
              <p className="wt-mono text-[10px]" style={{ color: 'var(--wt-text-faint)' }}>
                {formatBytes(poolInfo.alloc_bytes)} used of {formatBytes(poolInfo.size_bytes)}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Profile ── */}
      {profile && (
        <div className="mx-4 mb-3 rounded-xl border px-3 py-2.5"
          style={{ borderColor: 'var(--wt-border)', background: 'var(--wt-surface-2)' }}>
          <p className="wt-eyebrow mb-2">Profile</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <Row label="Purchased" value={profile.purchase_date || '—'} />
            <Row label="Warranty" value={formatWarrantyYears(profile.warranty_months)} />
            <Row label="Expires" value={formatExpiry(profile.warranty_expiry, warrantyDays)} warn={warrantyDays !== null && warrantyDays <= 90} />
            {profile.vendor && <Row label="Vendor" value={profile.vendor} />}
          </dl>
          {profile.notes && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--wt-border)' }}>
              <p className="wt-eyebrow mb-1">Notes</p>
              <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--wt-text)' }}>{profile.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Bay status ── */}
      {bayStatusInfo && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 border text-xs"
          style={bayStatusInfo.bgStyle}>
          <bayStatusInfo.icon size={12} style={bayStatusInfo.colorStyle} />
          <span className="font-medium" style={bayStatusInfo.colorStyle}>{bayStatusInfo.label}</span>
          <span style={{ color: 'var(--wt-text-faint)' }}>bay status</span>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: '1px solid var(--wt-border)' }}>
        {drive.last_scanned ? (
          <span className="wt-mono flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--wt-text-faint)' }}>
            <Clock size={10} />
            Scanned {new Date(drive.last_scanned).toLocaleString()}
          </span>
        ) : <span />}
        {!remote && (
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1 text-[10px] transition-colors text-[var(--wt-text-faint)] hover:text-[var(--wt-brand-500)]"
          >
            <History size={10} />
            History
          </button>
        )}
      </div>

      {historyOpen && (
        <DriveHistoryModal
          serial={drive.serial}
          make={drive.make}
          model={drive.model}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {breakdownOpen && healthScore !== null && (
        <HealthBreakdownModal
          drive={drive}
          score={healthScore}
          breakdown={healthBreakdown}
          history={history}
          onClose={() => setBreakdownOpen(false)}
        />
      )}
    </div>
  )
}

function Chip({ children, mono = false }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] leading-none ${mono ? 'wt-mono' : ''}`}
      style={{ background: 'var(--wt-surface-2)', borderColor: 'var(--wt-border)', color: 'var(--wt-text-muted)' }}>
      {children}
    </span>
  )
}
function Row({ label, value, warn }) {
  return (
    <>
      <dt className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>{label}</dt>
      <dd className="text-xs truncate" style={{ color: warn ? 'var(--wt-warn-600)' : 'var(--wt-text)', fontWeight: warn ? 500 : undefined }}>
        {value}
      </dd>
    </>
  )
}
