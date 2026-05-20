import { HardDrive } from 'lucide-react'
import clsx from 'clsx'
import WarningBadge from './WarningBadge'

function formatBytes(bytes) {
  if (!bytes) return ''
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  return `${(bytes / 1e9).toFixed(0)} GB`
}

export default function DriveList({ drives, profiles = [], selectedSerial, onSelect }) {
  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))
  const unassignedDrives = drives // caller filters if needed

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {unassignedDrives.length === 0 && (
        <p className="text-sm text-gray-500 p-3">No drives found. Run a scan.</p>
      )}
      {unassignedDrives.map(drive => {
        const profile = profileMap[drive.serial]
        const warrantyDays = profile?.warranty_days_remaining ?? null
        return (
          <button
            key={drive.serial}
            onClick={() => onSelect?.(drive.serial)}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
              selectedSerial === drive.serial
                ? 'bg-blue-700 text-white'
                : 'hover:bg-gray-700 text-gray-200'
            )}
          >
            <HardDrive size={18} className="shrink-0 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{drive.model || drive.serial}</p>
              <p className="text-xs text-gray-400 truncate font-mono">{drive.serial}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs text-gray-400">{formatBytes(drive.capacity_bytes)}</span>
              <WarningBadge status={drive.smart_status} days={warrantyDays} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
