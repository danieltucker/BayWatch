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
  damaged:    { label: 'Damaged',    icon: AlertTriangle, color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40' },
  hot_spare:  { label: 'Hot Spare',  icon: Zap,           color: 'text-cyan-500 dark:text-cyan-400',    bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/40' },
  cold_spare: { label: 'Cold Spare', icon: Archive,        color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/40' },
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
  if (state === 'ok')     return 'from-emerald-50 dark:from-emerald-500/10 to-white dark:to-gray-900 border-emerald-200 dark:border-emerald-700/30'
  if (state === 'warn')   return 'from-amber-50 dark:from-amber-500/10 to-white dark:to-gray-900 border-amber-300 dark:border-amber-600/50'
  if (state === 'failed') return 'from-red-50 dark:from-red-500/15 to-white dark:to-gray-900 border-red-300 dark:border-red-600/60'
  return 'from-slate-50 dark:from-gray-700/20 to-white dark:to-gray-900 border-slate-200 dark:border-gray-700/30'
}
function iconStyle(state) {
  if (state === 'failed') return { wrap: 'bg-red-100 dark:bg-red-950/40 border-red-200 dark:border-red-800/50',   icon: 'text-red-500 dark:text-red-400' }
  if (state === 'warn')   return { wrap: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40', icon: 'text-amber-500 dark:text-amber-400' }
  return { wrap: 'bg-slate-100 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700/50', icon: 'text-blue-500 dark:text-blue-400' }
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

  // Drive-type-aware age penalty
  const poh = drive.power_on_hours ?? 0
  const driveType = drive.drive_type || inferDriveType(drive)
  const ac = AGE_CURVES[driveType] || AGE_CURVES.consumer_hdd
  if (poh >= ac.warn) {
    const d = Math.max(-20, -Math.round(((poh - ac.warn) / Math.max(1, ac.max - ac.warn)) * 20))
    score += d
    breakdown.push({ factor: 'Drive age', detail: `${poh.toLocaleString()} hrs (${ac.label})`, delta: d })
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
  if (score == null) return { label: 'Unknown', color: '#94a3b8' }
  if (score >= 90)   return { label: 'Excellent', color: '#22c55e' }
  if (score >= 75)   return { label: 'Good',      color: '#4ade80' }
  if (score >= 60)   return { label: 'Fair',      color: '#f59e0b' }
  if (score >= 40)   return { label: 'Poor',      color: '#f97316' }
  return               { label: 'Critical',   color: '#ef4444' }
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
          <circle cx={26} cy={26} r={r} fill="none" stroke="currentColor"
            className="text-slate-200 dark:text-gray-800" strokeWidth={4} />
          <circle cx={26} cy={26} r={r} fill="none" stroke={color} strokeWidth={4}
            strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color }}>
            {score == null ? '?' : score}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight" style={{ color }}>{label}</p>
        <p className="text-[10px] text-slate-400 dark:text-gray-500 leading-snug">Health Score</p>
        <p className="text-[9px] text-slate-300 dark:text-gray-700 leading-snug mt-0.5">
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
  const axisStyle = { fontSize: 8, fill: 'currentColor' }

  return (
    <div className={`flex flex-col gap-0 rounded-2xl border bg-gradient-to-b overflow-hidden shadow-xl ${healthGradient(state)}`}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconWrap}`}>
            <DriveIcon size={18} className={iconCls} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight truncate">
              {drive.make || 'Unknown Make'}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-500 leading-snug truncate">{drive.model || 'Unknown Model'}</p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-gray-600 leading-snug">{drive.serial}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
          {remote && instanceName && (
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 shrink-0 uppercase tracking-wide">
              {instanceName}
            </span>
          )}
          <WarningBadge status={drive.smart_status} days={warrantyDays} />
          {onReassign && (
            <button onClick={onReassign} className="text-slate-400 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors p-0.5 rounded" title="Reassign bay">
              <ArrowLeftRight size={14} />
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="text-slate-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-0.5 rounded" title="Edit drive">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => setConfirmDelete(true)} className="text-slate-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-0.5 rounded" title="Delete drive">
              <Trash2 size={14} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-slate-400 dark:text-gray-600 hover:text-slate-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Delete confirm ── */}
      {confirmDelete && (
        <div className="mx-4 mb-1 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex items-center gap-3">
          <p className="text-xs text-red-700 dark:text-red-300 flex-1">Permanently delete this drive?</p>
          <button
            onClick={() => { onDelete(drive.serial); setConfirmDelete(false) }}
            className="px-2.5 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors"
          >Delete</button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 text-xs transition-colors hover:border-slate-300 dark:hover:border-gray-600"
          >Cancel</button>
        </div>
      )}

      {/* ── Disconnected banner ── */}
      {drive.is_connected === false && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
          <WifiOff size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Drive not detected</p>
            {drive.last_scanned && (
              <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 leading-snug">
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
        <div className="mx-4 mb-3 rounded-xl border border-slate-200 dark:border-gray-700/50 bg-slate-50/80 dark:bg-gray-800/20 px-3 py-2.5">
          <HealthRing score={healthScore} onClick={() => setBreakdownOpen(true)} />
        </div>
      )}

      {/* ── Temperature + Power-on hours ── */}
      {(drive.temperature_c != null || drive.power_on_hours != null) && (
        <div className={`px-4 pb-3 grid gap-3 ${drive.temperature_c != null && drive.power_on_hours != null ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {drive.temperature_c != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wider">Temp</span>
                <span className={`text-xs font-bold ${
                  drive.temperature_c >= dangerC ? 'text-red-500 dark:text-red-400' :
                  drive.temperature_c >= warnC   ? 'text-amber-500 dark:text-amber-400' :
                  'text-sky-500 dark:text-sky-400'
                }`}>{drive.temperature_c}°C</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800/80 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  drive.temperature_c >= dangerC ? 'bg-red-400' :
                  drive.temperature_c >= warnC   ? 'bg-amber-400' : 'bg-sky-500'
                }`} style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }} />
              </div>
            </div>
          )}
          {drive.power_on_hours != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wider">Hours</span>
                <span className="text-xs font-bold text-slate-500 dark:text-gray-400">{drive.power_on_hours.toLocaleString()}h</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800/80 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  drive.power_on_hours >= 40000 ? 'bg-orange-400' :
                  drive.power_on_hours >= 25000 ? 'bg-amber-400' : 'bg-blue-400'
                }`} style={{ width: `${Math.min(100, (drive.power_on_hours / 50000) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Remote history error banner ── */}
      {remote && remoteHistoryError && (
        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
          <AlertTriangle size={12} className="text-amber-500 dark:text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400">History unavailable: {remoteHistoryError} — showing last cached data</p>
        </div>
      )}

      {/* ── Lifetime I/O ── */}
      {(lifetimeReadBytes != null || lifetimeWriteBytes != null) && (
        <div className={`px-4 pb-3 grid gap-3 ${lifetimeReadBytes != null && lifetimeWriteBytes != null ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {lifetimeReadBytes != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wider">Read</span>
                <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">{formatBytes(lifetimeReadBytes)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800/80 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(100, (lifetimeReadBytes / ioMaxRead) * 100)}%` }} />
              </div>
            </div>
          )}
          {lifetimeWriteBytes != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wider">Write</span>
                <span className="text-xs font-bold text-violet-500 dark:text-violet-400">{formatBytes(lifetimeWriteBytes)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800/80 overflow-hidden">
                <div className="h-full rounded-full bg-violet-400 transition-all"
                  style={{ width: `${Math.min(100, (lifetimeWriteBytes / ioMaxWrite) * 100)}%` }} />
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
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
                <ShieldAlert size={13} className="text-red-500 dark:text-red-400 shrink-0" />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">SMART failure detected</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Reallocated', value: drive.reallocated_sectors },
                { label: 'Pending',     value: drive.pending_sectors },
                { label: 'Uncorrect.',  value: drive.uncorrectable_errors },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-lg px-2 py-2 text-center border ${
                  (value ?? 0) > 0
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40'
                    : 'bg-slate-50 dark:bg-gray-800/30 border-slate-200 dark:border-gray-700/40'
                }`}>
                  <p className={`text-sm font-bold leading-none ${(value ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-gray-600'}`}>
                    {value ?? '—'}
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-gray-600 mt-1 leading-none">{label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : drive.smart_status === 'PASSED' ? (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30">
            <CheckCircle2 size={13} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400">No SMART errors detected</span>
          </div>
        ) : null}
      </div>

      {/* ── Temperature history — gradient area chart, 25–65°C scale ── */}
      {tempHistory.length > 1 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Temp History (30d)</p>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={tempHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} domain={[tempDomainLow, tempDomainHigh]} />
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
          <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Used Space (30d)</p>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={spaceHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="spaceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2dd4bf" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} unit=" GB" />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} GB`, 'Used']} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="usedGB" stroke="#2dd4bf" fill="url(#spaceGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Reallocated sectors trend ── */}
      {hasReallocHistory && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Reallocated Sectors (30d)</p>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={reallocHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="reallocGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Sectors']} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="sectors" stroke="#f59e0b" fill="url(#reallocGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── I/O activity chart ── */}
      {ioHistory.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-0.5">I/O Activity (30d)</p>
          <p className="text-[9px] text-slate-300 dark:text-gray-700 mb-1.5">{ioUnit} per scan interval · this drive</p>
          <div className="flex items-center gap-3 mb-1">
            <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-gray-600"><span className="w-2 h-0.5 rounded bg-emerald-400 inline-block" />Read</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-gray-600"><span className="w-2 h-0.5 rounded bg-violet-400 inline-block" />Write</span>
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
              <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} unit={` ${ioUnit}`} />
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
            <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-2">Partitions</p>
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
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{fstypeLabel(entry.fstype)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-600 ml-auto shrink-0">{formatSize(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── ZFS pool ── */}
      {drive.zfs_pool && (
        <div className="mx-4 mb-3 rounded-xl border border-blue-200/60 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-950/10 px-3 py-2.5">
          <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">ZFS Pool</p>
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 truncate">{drive.zfs_pool}</span>
            {drive.vdev_name && (
              <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 shrink-0">
                {drive.vdev_name}
              </span>
            )}
            {poolInfo && (
              <span className="text-[10px] text-slate-500 dark:text-gray-500 shrink-0">{poolInfo.capacity_pct}% used</span>
            )}
          </div>
          {poolInfo && (
            <>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all ${
                  poolInfo.capacity_pct >= 80 ? 'bg-red-400' :
                  poolInfo.capacity_pct >= 60 ? 'bg-amber-400' : 'bg-blue-400'
                }`} style={{ width: `${poolInfo.capacity_pct}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-gray-600">
                {formatBytes(poolInfo.alloc_bytes)} used of {formatBytes(poolInfo.size_bytes)}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Profile ── */}
      {profile && (
        <div className="mx-4 mb-3 rounded-xl border border-slate-200 dark:border-gray-700/50 bg-slate-50 dark:bg-gray-800/20 px-3 py-2.5">
          <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">Profile</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <Row label="Purchased" value={profile.purchase_date || '—'} />
            <Row label="Warranty" value={formatWarrantyYears(profile.warranty_months)} />
            <Row label="Expires" value={formatExpiry(profile.warranty_expiry, warrantyDays)} warn={warrantyDays !== null && warrantyDays <= 90} />
            {profile.vendor && <Row label="Vendor" value={profile.vendor} />}
          </dl>
          {profile.notes && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-gray-700/40">
              <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-slate-700 dark:text-gray-200 whitespace-pre-wrap">{profile.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Bay status ── */}
      {bayStatusInfo && (
        <div className={`mx-4 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 border text-xs ${bayStatusInfo.bg}`}>
          <bayStatusInfo.icon size={12} className={bayStatusInfo.color} />
          <span className={`font-medium ${bayStatusInfo.color}`}>{bayStatusInfo.label}</span>
          <span className="text-slate-400 dark:text-gray-500">bay status</span>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-gray-800/50">
        {drive.last_scanned ? (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-gray-600">
            <Clock size={10} />
            Scanned {new Date(drive.last_scanned).toLocaleString()}
          </span>
        ) : <span />}
        {!remote && (
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700/50 text-[10px] text-slate-600 dark:text-gray-400 leading-none ${mono ? 'font-mono' : ''}`}>
      {children}
    </span>
  )
}
function Row({ label, value, warn }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-gray-500 text-xs">{label}</dt>
      <dd className={`text-xs truncate ${warn ? 'text-amber-500 dark:text-amber-400 font-medium' : 'text-slate-700 dark:text-gray-200'}`}>
        {value}
      </dd>
    </>
  )
}
