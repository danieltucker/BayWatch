import { HardDrive, Clock, X } from 'lucide-react'
import WarningBadge from './WarningBadge'

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

function healthGradient(status) {
  if (status === 'PASSED') return 'from-emerald-500/10 to-transparent border-emerald-700/30'
  if (status === 'FAILED') return 'from-red-500/15 to-transparent border-red-700/40'
  return 'from-gray-700/20 to-transparent border-gray-700/30'
}

export default function DriveCard({ drive, profile, onClose }) {
  if (!drive) return null

  const warrantyDays = profile?.warranty_days_remaining ?? null

  return (
    <div className={`flex flex-col gap-0 rounded-2xl border bg-gradient-to-b overflow-hidden shadow-xl ${healthGradient(drive.smart_status)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center shrink-0">
            <HardDrive size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">
              {drive.model || 'Unknown Model'}
            </p>
            <p className="text-xs text-gray-500">{drive.make || 'Unknown make'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <WarningBadge status={drive.smart_status} days={warrantyDays} />
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-300 transition-colors p-0.5 rounded"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Temperature bar */}
      {drive.temperature_c != null && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Temperature</span>
            <span className={`text-xs font-bold ${drive.temperature_c >= 55 ? 'text-amber-400' : 'text-sky-400'}`}>
              {drive.temperature_c}°C
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800/80 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${drive.temperature_c >= 55 ? 'bg-amber-400' : 'bg-sky-500'}`}
              style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-800/60 mx-4" />

      {/* Stats grid */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm px-4 py-3">
        <Row label="Serial" value={drive.serial} mono />
        <Row label="Capacity" value={formatBytes(drive.capacity_bytes)} />
        <Row label="Form factor" value={drive.form_factor || '—'} />
        <Row label="Type" value={drive.rpm === 0 ? 'SSD' : drive.rpm ? `HDD ${drive.rpm.toLocaleString()}rpm` : '—'} />
        <Row label="Firmware" value={drive.firmware_version || '—'} mono />
        <Row label="Device" value={drive.device_path || '—'} mono />

        <div className="col-span-2 border-t border-gray-800/50 my-0.5" />

        <Row label="Power-on" value={formatHours(drive.power_on_hours)} />
        <Row label="Reallocated" value={drive.reallocated_sectors ?? '—'} warn={(drive.reallocated_sectors ?? 0) > 0} />
        <Row label="Pending" value={drive.pending_sectors ?? '—'} warn={(drive.pending_sectors ?? 0) > 0} />
        <Row label="Uncorrectable" value={drive.uncorrectable_errors ?? '—'} warn={(drive.uncorrectable_errors ?? 0) > 0} />

        {profile && (
          <>
            <div className="col-span-2 border-t border-gray-800/50 my-0.5" />
            <Row label="Purchased" value={profile.purchase_date || '—'} />
            <Row label="Warranty" value={profile.warranty_months ? `${profile.warranty_months}mo` : '—'} />
            <Row
              label="Expires"
              value={profile.warranty_expiry || '—'}
              warn={warrantyDays !== null && warrantyDays <= 90}
            />
            {profile.vendor && <Row label="Vendor" value={profile.vendor} />}
          </>
        )}
      </dl>

      {drive.last_scanned && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-gray-800/50 text-[10px] text-gray-600">
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
      <dt className="text-gray-500 text-xs">{label}</dt>
      <dd className={`text-xs truncate ${mono ? 'font-mono' : ''} ${warn ? 'text-amber-400 font-medium' : 'text-gray-200'}`}>
        {value}
      </dd>
    </>
  )
}
