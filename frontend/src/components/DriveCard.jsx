import { Clock, X, Pencil } from 'lucide-react'
import WarningBadge from './WarningBadge'
import { getDriveIcon } from '../utils/driveIcon'

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

function healthGradient(status) {
  if (status === 'PASSED') return 'from-emerald-50 dark:from-emerald-500/10 to-transparent border-emerald-200 dark:border-emerald-700/30'
  if (status === 'FAILED') return 'from-red-50 dark:from-red-500/15 to-transparent border-red-200 dark:border-red-700/40'
  return 'from-slate-50 dark:from-gray-700/20 to-transparent border-slate-200 dark:border-gray-700/30'
}

export default function DriveCard({ drive, profile, onClose, onEdit }) {
  if (!drive) return null

  const warrantyDays = profile?.warranty_days_remaining ?? null
  const DriveIcon = getDriveIcon(drive.form_factor, drive.rpm)

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
              {drive.model || 'Unknown Model'}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-500">{drive.make || 'Unknown make'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <WarningBadge status={drive.smart_status} days={warrantyDays} />
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

      {/* Temperature bar */}
      {drive.temperature_c != null && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 dark:text-gray-500 uppercase tracking-wider">Temperature</span>
            <span className={`text-xs font-bold ${drive.temperature_c >= 55 ? 'text-amber-500 dark:text-amber-400' : 'text-sky-500 dark:text-sky-400'}`}>
              {drive.temperature_c}°C
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-gray-800/80 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${drive.temperature_c >= 55 ? 'bg-amber-400' : 'bg-sky-500'}`}
              style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
            />
          </div>
        </div>
      )}

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

        <Row label="Power-on" value={formatHours(drive.power_on_hours)} />
        <Row label="Reallocated" value={drive.reallocated_sectors ?? '—'} warn={(drive.reallocated_sectors ?? 0) > 0} />
        <Row label="Pending" value={drive.pending_sectors ?? '—'} warn={(drive.pending_sectors ?? 0) > 0} />
        <Row label="Uncorrectable" value={drive.uncorrectable_errors ?? '—'} warn={(drive.uncorrectable_errors ?? 0) > 0} />

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
