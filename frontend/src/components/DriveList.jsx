import { useState } from 'react'
import { Search, Eye, EyeOff } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import clsx from 'clsx'
import WarningBadge from './WarningBadge'
import { getDriveIcon } from '../utils/driveIcon'

function formatBytes(bytes) {
  if (!bytes) return ''
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  return `${(bytes / 1e9).toFixed(0)} GB`
}

function DraggableDriveItem({ drive, profile, isSelected, onSelect, isAssigned }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drive-${drive.serial}`,
    data: { serial: drive.serial },
  })

  const warrantyDays = profile?.warranty_days_remaining ?? null
  const DriveIcon = getDriveIcon(drive.form_factor, drive.rpm)

  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-30' : isAssigned ? 'opacity-50' : ''}>
      <button
        onClick={() => onSelect?.(drive.serial)}
        {...listeners}
        {...attributes}
        className={clsx(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors w-full cursor-grab active:cursor-grabbing',
          isSelected
            ? 'bg-blue-600 text-white'
            : 'hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200'
        )}
      >
        <DriveIcon size={18} className={clsx('shrink-0', isSelected ? 'text-blue-200' : 'text-slate-400 dark:text-gray-400')} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{drive.model || drive.serial}</p>
          <p className={clsx('text-xs truncate font-mono', isSelected ? 'text-blue-200' : 'text-slate-400 dark:text-gray-400')}>{drive.serial}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx('text-xs', isSelected ? 'text-blue-200' : 'text-slate-400 dark:text-gray-400')}>{formatBytes(drive.capacity_bytes)}</span>
          {drive.zfs_pool && !isSelected && (
            <span className="text-[9px] font-mono font-medium px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 leading-none">
              {drive.zfs_pool}
            </span>
          )}
          <WarningBadge status={drive.smart_status} days={warrantyDays} />
        </div>
      </button>
    </div>
  )
}

export default function DriveList({ drives, profiles = [], selectedSerial, onSelect, assignedSerials }) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))

  const assigned = assignedSerials ?? new Set()
  const q = query.trim().toLowerCase()

  const filtered = drives.filter(drive => {
    if (q) {
      return (
        drive.serial?.toLowerCase().includes(q) ||
        drive.model?.toLowerCase().includes(q) ||
        drive.make?.toLowerCase().includes(q) ||
        drive.device_path?.toLowerCase().includes(q) ||
        drive.firmware_version?.toLowerCase().includes(q)
      )
    }
    if (!showAll && assigned.has(drive.serial)) return false
    return true
  })

  const assignedCount = drives.filter(d => assigned.has(d.serial)).length

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search drives…"
          className="w-full rounded-md bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700/60 pl-7 pr-3 py-1.5 text-xs text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {assignedCount > 0 && !q && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 transition-colors self-start px-0.5"
        >
          {showAll ? <EyeOff size={12} /> : <Eye size={12} />}
          {showAll ? 'Hide' : `Show ${assignedCount}`} assigned
        </button>
      )}

      <div className="flex flex-col gap-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-gray-500 p-3">
            {drives.length === 0
              ? 'No drives found. Run a scan.'
              : q
              ? 'No drives match.'
              : 'All drives assigned.'}
          </p>
        )}
        {filtered.map(drive => (
          <DraggableDriveItem
            key={drive.serial}
            drive={drive}
            profile={profileMap[drive.serial]}
            isSelected={selectedSerial === drive.serial}
            onSelect={onSelect}
            isAssigned={assigned.has(drive.serial)}
          />
        ))}
      </div>
    </div>
  )
}
