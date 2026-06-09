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
          !isSelected && 'hover:bg-[var(--wt-surface-2)]',
        )}
        style={isSelected
          ? { background: 'var(--wt-brand-600)', color: 'var(--wt-text-on-brand)' }
          : { color: 'var(--wt-text)' }
        }
      >
        <DriveIcon size={18} className="shrink-0"
          style={{ color: isSelected ? 'var(--wt-brand-200)' : 'var(--wt-text-faint)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{drive.make || drive.serial}</p>
          <p className="text-xs truncate"
            style={{ color: isSelected ? 'var(--wt-brand-200)' : 'var(--wt-text-muted)' }}>
            {drive.model || drive.serial}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="wt-mono text-xs"
            style={{ color: isSelected ? 'var(--wt-brand-200)' : 'var(--wt-text-faint)' }}>
            {formatBytes(drive.capacity_bytes)}
          </span>
          {drive.zfs_pool && !isSelected && (
            <span className="text-[9px] font-mono font-medium px-1 py-0.5 rounded leading-none"
              style={{ background: 'var(--wt-brand-50)', color: 'var(--wt-brand-600)', border: '1px solid var(--wt-brand-200)' }}>
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
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--wt-text-faint)' }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search drives…"
          className="wt-input w-full pl-7 pr-3 py-1.5 text-xs"
        />
      </div>

      {assignedCount > 0 && !q && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-1.5 text-xs transition-colors self-start px-0.5 text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]"
        >
          {showAll ? <EyeOff size={12} /> : <Eye size={12} />}
          {showAll ? 'Hide' : `Show ${assignedCount}`} assigned
        </button>
      )}

      <div className="flex flex-col gap-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm p-3" style={{ color: 'var(--wt-text-muted)' }}>
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
