import { HardDrive, Thermometer, Clock, AlertTriangle } from 'lucide-react'
import WarningBadge from './WarningBadge'

function formatBytes(bytes) {
  if (!bytes) return '—'
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  const gb = bytes / 1e9
  return `${gb.toFixed(0)} GB`
}

function formatHours(hours) {
  if (hours == null) return '—'
  const days = Math.floor(hours / 24)
  const yrs = (days / 365).toFixed(1)
  return `${hours.toLocaleString()}h (${yrs}y)`
}

export default function DriveCard({ drive, profile, onClose }) {
  if (!drive) return null

  const warrantyDays = profile?.warranty_days_remaining ?? null

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-gray-800 p-5 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <HardDrive size={22} className="text-blue-400 shrink-0" />
          <div>
            <p className="font-semibold text-white leading-tight">
              {drive.model || 'Unknown Model'}
            </p>
            <p className="text-xs text-gray-400">{drive.make || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WarningBadge status={drive.smart_status} days={warrantyDays} />
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">×</button>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Serial" value={drive.serial} mono />
        <Row label="Capacity" value={formatBytes(drive.capacity_bytes)} />
        <Row label="Form factor" value={drive.form_factor || '—'} />
        <Row label="RPM" value={drive.rpm === 0 ? 'SSD' : drive.rpm ? `${drive.rpm.toLocaleString()}` : '—'} />
        <Row label="Firmware" value={drive.firmware_version || '—'} mono />
        <Row label="Device" value={drive.device_path || '—'} mono />

        <div className="col-span-2 border-t border-gray-700 pt-2 mt-1" />

        <Row
          label="Temperature"
          value={drive.temperature_c != null ? `${drive.temperature_c}°C` : '—'}
          warn={drive.temperature_c != null && drive.temperature_c >= 55}
        />
        <Row label="Power-on" value={formatHours(drive.power_on_hours)} />
        <Row
          label="Reallocated"
          value={drive.reallocated_sectors ?? '—'}
          warn={(drive.reallocated_sectors ?? 0) > 0}
        />
        <Row label="Pending" value={drive.pending_sectors ?? '—'} warn={(drive.pending_sectors ?? 0) > 0} />
        <Row label="Uncorrectable" value={drive.uncorrectable_errors ?? '—'} warn={(drive.uncorrectable_errors ?? 0) > 0} />

        {profile && (
          <>
            <div className="col-span-2 border-t border-gray-700 pt-2 mt-1" />
            <Row label="Purchased" value={profile.purchase_date || '—'} />
            <Row label="Warranty" value={profile.warranty_months ? `${profile.warranty_months}mo` : '—'} />
            <Row
              label="Warranty exp."
              value={profile.warranty_expiry || '—'}
              warn={warrantyDays !== null && warrantyDays <= 90}
            />
            {profile.vendor && <Row label="Vendor" value={profile.vendor} />}
          </>
        )}
      </dl>

      {drive.last_scanned && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={12} />
          Last scanned {new Date(drive.last_scanned).toLocaleString()}
        </p>
      )}
    </div>
  )
}

function Row({ label, value, mono, warn }) {
  return (
    <>
      <dt className="text-gray-400">{label}</dt>
      <dd className={`${mono ? 'font-mono text-xs' : ''} ${warn ? 'text-yellow-400' : 'text-gray-100'} truncate`}>
        {value}
      </dd>
    </>
  )
}
