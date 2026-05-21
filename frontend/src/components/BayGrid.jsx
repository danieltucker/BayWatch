import { useState } from 'react'
import clsx from 'clsx'
import BaySlot from './BaySlot'

const SIZES = ['sm', 'md', 'lg']

const GROUP_TYPE_LABEL = {
  drive_bays: 'Drive Bays',
  zfs_pool: 'ZFS Pool',
  zfs_mirror: 'ZFS Mirror',
  zfs_raidz1: 'ZFS RAIDZ1',
  zfs_raidz2: 'ZFS RAIDZ2',
  hardware_raid: 'HW RAID',
  pcie_slots: 'PCIe Slots',
  standalone: 'Standalone',
  other: 'Other',
}

const GAP = { sm: 'gap-1', md: 'gap-1.5', lg: 'gap-2' }

export default function BayGrid({ array, bays, driveMap, profileMap, selectedBayId, onBayClick }) {
  const storageKey = `array-size-${array.id}`
  const [size, setSize] = useState(() => localStorage.getItem(storageKey) || 'sm')

  const rows = array.rows
  const cols = array.cols

  const bayGrid = {}
  for (const bay of bays) {
    bayGrid[`${bay.row}-${bay.col}`] = bay
  }

  function handleSize(s) {
    setSize(s)
    localStorage.setItem(storageKey, s)
  }

  const groupLabel = GROUP_TYPE_LABEL[array.group_type] || array.group_type

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-gray-300 truncate">{array.name}</h3>
          {array.group_type && array.group_type !== 'drive_bays' && (
            <span className="text-[10px] font-medium text-slate-400 dark:text-gray-600 bg-slate-100 dark:bg-gray-800/60 px-1.5 py-0.5 rounded-full shrink-0">
              {groupLabel}
            </span>
          )}
          {array.purpose && (
            <span className="text-[10px] text-slate-400 dark:text-gray-600 truncate hidden sm:block">{array.purpose}</span>
          )}
        </div>
        <div className="flex rounded-md border border-slate-200 dark:border-gray-700/60 overflow-hidden shrink-0">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => handleSize(s)}
              className={clsx(
                'px-2 py-0.5 text-[10px] font-medium transition-colors',
                size === s
                  ? 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200'
                  : 'text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400'
              )}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div
        className={clsx('grid w-full', GAP[size])}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const bay = bayGrid[`${r}-${c}`]
            if (!bay) return <div key={`${r}-${c}`} />
            const drive = bay.drive_serial ? driveMap[bay.drive_serial] : null
            const profile = drive && profileMap ? profileMap[drive.serial] : null
            return (
              <BaySlot
                key={bay.id}
                bay={bay}
                drive={drive}
                profile={profile}
                size={size}
                isSelected={selectedBayId === bay.id}
                onClick={onBayClick}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
