import { useEffect, useState } from 'react'
import { Clock, X, Pencil, AlertTriangle, Zap, Archive, ArrowLeftRight } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts'
import WarningBadge from './WarningBadge'
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

function formatHours(hours) {
  if (hours == null) return '—'
  const yrs = (hours / 24 / 365).toFixed(1)
  return `${hours.toLocaleString()}h (${yrs}y)`
}

function formatWarrantyYears(months) {
  if (!months) return '—'
  const yrs = months / 12
  return `${parseFloat(yrs.toFixed(1))} yrs`
}

function formatExpiry(expiryDate, daysRemaining) {
  if (!expiryDate) return '—'
  const dateStr = new Date(expiryDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  if (daysRemaining == null) return dateStr
  if (daysRemaining > 0) {
    const yrs = parseFloat((daysRemaining / 365).toFixed(1))
    return `${dateStr} · ${yrs}y left`
  }
  const moAgo = Math.abs(Math.round(daysRemaining / 30))
  return `${dateStr} · ${moAgo}mo ago`
}

const FSTYPE_COLORS = {
  zfs_member: '#3b82f6',
  ext4: '#22c55e', ext3: '#22c55e', ext2: '#22c55e',
  btrfs: '#14b8a6',
  xfs: '#8b5cf6',
  swap: '#f59e0b',
  ntfs: '#f97316', vfat: '#f97316', exfat: '#f97316',
}
function fstypeColor(fstype) {
  return FSTYPE_COLORS[fstype?.toLowerCase()] ?? '#64748b'
}
function fstypeLabel(fstype) {
  return fstype ?? 'unknown'
}
function formatGB(bytes) {
  if (!bytes) return '0 GB'
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  return `${(bytes / 1e9).toFixed(0)} GB`
}

function healthGradient(status) {
  if (status === 'PASSED') return 'from-emerald-50 dark:from-emerald-500/10 to-transparent border-emerald-200 dark:border-emerald-700/30'
  if (status === 'FAILED') return 'from-red-50 dark:from-red-500/15 to-transparent border-red-200 dark:border-red-700/40'
  return 'from-slate-50 dark:from-gray-700/20 to-transparent border-slate-200 dark:border-gray-700/30'
}

export default function DriveCard({ drive, profile, bay, poolStats = [], onClose, onEdit, onReassign }) {
  const { warnC, dangerC } = useTempThresholds()
  const [history, setHistory] = useState([])
  const [partitions, setPartitions] = useState([])

  useEffect(() => {
    if (!drive) return
    setHistory([])
    setPartitions([])
    getDriveHistory(drive.serial, 30).then(setHistory).catch(() => {})
    getDrivePartitions(drive.serial).then(setPartitions).catch(() => {})
  }, [drive?.serial])

  if (!drive) return null

  const warrantyDays = profile?.warranty_days_remaining ?? null
  const DriveIcon = getDriveIcon(drive.form_factor, drive.rpm)
  const poolInfo = drive.zfs_pool ? poolStats.find(p => p.name === drive.zfs_pool) : null
  const bayStatusInfo = bay?.status ? BAY_STATUS_INFO[bay.status] : null

  const tempHistory = history.filter(h => h.temperature_c != null).map(h => ({
    date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    temp: h.temperature_c,
  }))

  const reallocHistory = history.filter(h => h.reallocated_sectors != null).map(h => ({
    date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sectors: h.reallocated_sectors,
  }))
  const hasReallocHistory = reallocHistory.some(h => h.sectors > 0)

  return (
    <div className={`flex flex-col gap-0 rounded-2xl border bg-gradient-to-b overflow-hidden shadow-xl ${healthGradient(drive.smart_status)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center shrink-0">
            <DriveIcon size={18} className="text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm leading-tight">
              {drive.make || 'Unknown Make'}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-500">{drive.model || 'Unknown Model'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <WarningBadge status={drive.smart_status} days={warrantyDays} />
          {onReassign && (
            <button
              onClick={onReassign}
              className="text-slate-400 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors p-0.5 rounded"
              title="Reassign bay"
            >
              <ArrowLeftRight size={14} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-slate-400 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-0.5 rounded"
              title="Edit drive"
            >
              <Pencil size={14} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 dark:text-gray-600 hover:text-slate-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Temperature + Power-on bars */}
      <div className="px-4 pb-3 flex flex-col gap-2">
        {drive.temperature_c != null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wider">Temperature</span>
              <span className={`text-xs font-bold ${
                drive.temperature_c >= dangerC ? 'text-red-500 dark:text-red-400' :
                drive.temperature_c >= warnC   ? 'text-amber-500 dark:text-amber-400' :
                'text-sky-500 dark:text-sky-400'
              }`}>
                {drive.temperature_c}°C
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  drive.temperature_c >= dangerC ? 'bg-red-400' :
                  drive.temperature_c >= warnC   ? 'bg-amber-400' : 'bg-sky-500'
                }`}
                style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {drive.power_on_hours != null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wider">Power-on Hours</span>
              <span className="text-xs font-bold text-slate-500 dark:text-gray-400">
                {drive.power_on_hours.toLocaleString()}h
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  drive.power_on_hours >= 40000 ? 'bg-orange-400' :
                  drive.power_on_hours >= 25000 ? 'bg-amber-400' : 'bg-blue-400'
                }`}
                style={{ width: `${Math.min(100, (drive.power_on_hours / 50000) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Temperature history chart */}
      {tempHistory.length > 1 && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Temp History (30d)</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={tempHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}
                formatter={v => [`${v}°C`, 'Temp']}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine y={warnC} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={dangerC} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
              <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Reallocated sectors history chart */}
      {hasReallocHistory && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Reallocated Sectors (30d)</p>
          <ResponsiveContainer width="100%" height={64}>
            <AreaChart data={reallocHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}
                formatter={v => [v, 'Sectors']}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="sectors" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Partition donut chart */}
      {partitions.length > 0 && (() => {
        const usedBytes = partitions.reduce((s, p) => s + (p.size_bytes || 0), 0)
        const unpartitioned = drive.capacity_bytes ? Math.max(0, drive.capacity_bytes - usedBytes) : 0
        const pieData = [
          ...partitions.map(p => ({ name: p.label || p.name, fstype: p.fstype, value: p.size_bytes || 0 })),
          ...(unpartitioned > 0 ? [{ name: 'Unpartitioned', fstype: null, value: unpartitioned }] : []),
        ]
        return (
          <div className="px-4 pb-3">
            <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-2">Partitions</p>
            <div className="flex items-center gap-4">
              <PieChart width={80} height={80}>
                <Pie data={pieData} cx={35} cy={35} innerRadius={22} outerRadius={36} dataKey="value" stroke="none">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={fstypeColor(entry.fstype)} />
                  ))}
                </Pie>
              </PieChart>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: fstypeColor(entry.fstype) }} />
                    <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{fstypeLabel(entry.fstype)}</span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-600 ml-auto shrink-0">{formatGB(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-gray-800/60 mx-4" />

      {/* Stats grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm px-4 py-3">
        <Row label="Serial" value={drive.serial} mono />
        <Row label="Capacity" value={formatBytes(drive.capacity_bytes)} />
        <Row label="Form factor" value={drive.form_factor || '—'} />
        <Row label="Type" value={drive.rpm === 0 ? 'SSD' : drive.rpm ? `HDD ${drive.rpm.toLocaleString()}rpm` : '—'} />
        <Row label="Firmware" value={drive.firmware_version || '—'} mono />
        <Row label="Device" value={drive.device_path || '—'} mono />

        <div className="col-span-2 border-t border-slate-200 dark:border-gray-800/50 my-0.5" />

        <Row label="Reallocated" value={drive.reallocated_sectors ?? '—'} warn={(drive.reallocated_sectors ?? 0) > 0} />
        <Row label="Pending" value={drive.pending_sectors ?? '—'} warn={(drive.pending_sectors ?? 0) > 0} />
        <Row label="Uncorrectable" value={drive.uncorrectable_errors ?? '—'} warn={(drive.uncorrectable_errors ?? 0) > 0} />

        {drive.zfs_pool && (
          <>
            <div className="col-span-2 border-t border-slate-200 dark:border-gray-800/50 my-0.5" />
            <div className="col-span-2">
              <dt className="text-slate-500 dark:text-gray-500 text-xs mb-1.5">ZFS Pool</dt>
              <dd>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400">{drive.zfs_pool}</span>
                  {poolInfo && (
                    <span className="text-[10px] text-slate-500 dark:text-gray-500">
                      {poolInfo.capacity_pct}% used
                    </span>
                  )}
                </div>
                {poolInfo && (
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        poolInfo.capacity_pct >= 80 ? 'bg-red-400' :
                        poolInfo.capacity_pct >= 60 ? 'bg-amber-400' : 'bg-blue-400'
                      }`}
                      style={{ width: `${poolInfo.capacity_pct}%` }}
                    />
                  </div>
                )}
                {poolInfo && (
                  <p className="text-[10px] text-slate-400 dark:text-gray-600 mt-0.5">
                    {formatBytes(poolInfo.alloc_bytes)} used of {formatBytes(poolInfo.size_bytes)}
                  </p>
                )}
              </dd>
            </div>
          </>
        )}

        {profile && (
          <>
            <div className="col-span-2 border-t border-slate-200 dark:border-gray-800/50 my-0.5" />
            <Row label="Purchased" value={profile.purchase_date || '—'} />
            <Row label="Warranty" value={formatWarrantyYears(profile.warranty_months)} />
            <Row
              label="Expires"
              value={formatExpiry(profile.warranty_expiry, warrantyDays)}
              warn={warrantyDays !== null && warrantyDays <= 90}
            />
            {profile.vendor && <Row label="Vendor" value={profile.vendor} />}
            {profile.notes && (
              <>
                <div className="col-span-2 border-t border-slate-200 dark:border-gray-800/50 my-0.5" />
                <div className="col-span-2">
                  <dt className="text-slate-500 dark:text-gray-500 text-xs mb-1">Notes</dt>
                  <dd className="text-xs text-slate-700 dark:text-gray-200 whitespace-pre-wrap">{profile.notes}</dd>
                </div>
              </>
            )}
          </>
        )}
      </dl>

      {bayStatusInfo && (
        <div className={`mx-4 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 border text-xs ${bayStatusInfo.bg}`}>
          <bayStatusInfo.icon size={12} className={bayStatusInfo.color} />
          <span className={`font-medium ${bayStatusInfo.color}`}>{bayStatusInfo.label}</span>
          <span className="text-slate-400 dark:text-gray-500">bay status</span>
        </div>
      )}

      {drive.last_scanned && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-slate-200 dark:border-gray-800/50 text-[10px] text-slate-400 dark:text-gray-600">
          <Clock size={10} />
          Scanned {new Date(drive.last_scanned).toLocaleString()}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono, warn }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-gray-500 text-xs">{label}</dt>
      <dd className={`text-xs truncate ${mono ? 'font-mono' : ''} ${warn ? 'text-amber-500 dark:text-amber-400 font-medium' : 'text-slate-700 dark:text-gray-200'}`}>
        {value}
      </dd>
    </>
  )
}
