import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
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

function computeStats(bays, driveMap) {
  const total = bays.length
  const drives = bays.map(b => b.drive_serial ? driveMap[b.drive_serial] : null).filter(Boolean)
  const occupied = drives.length
  const temps = drives.map(d => d.temperature_c).filter(t => t != null)
  const avgTemp = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null
  let passed = 0, failed = 0, warn = 0
  for (const d of drives) {
    if (d.smart_status === 'FAILED') { failed++; continue }
    if (d.smart_status === 'PASSED') {
      const hasErrors = (d.reallocated_sectors ?? 0) > 0 || (d.pending_sectors ?? 0) > 0 || (d.uncorrectable_errors ?? 0) > 0
      if (hasErrors) warn++; else passed++
    }
  }
  return { total, occupied, avgTemp, passed, failed, warn }
}

export default function BayGrid({ array, bays, driveMap, profileMap, selectedBayId, onBayClick, highlightVdev }) {
  const sizeKey = `array-size-${array.id}`
  const collapseKey = `array-collapsed-${array.id}`
  const [size, setSize] = useState(() => localStorage.getItem(sizeKey) || 'sm')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(collapseKey) === 'true')

  const rows = array.rows
  const cols = array.cols

  const bayGrid = {}
  for (const bay of bays) {
    bayGrid[`${bay.row}-${bay.col}`] = bay
  }

  function handleSize(s) {
    setSize(s)
    localStorage.setItem(sizeKey, s)
  }

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(collapseKey, String(next))
  }

  const groupLabel = GROUP_TYPE_LABEL[array.group_type] || array.group_type
  const stats = computeStats(bays, driveMap)

  return (
    <div className="w-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={toggleCollapse}
            className="text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 shrink-0 transition-colors"
          >
            {collapsed
              ? <ChevronRight size={14} />
              : <ChevronDown size={14} />
            }
          </button>
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

      {/* Stats strip */}
      <div className="flex items-center gap-3 mb-3 px-0.5">
        <span className="text-[10px] text-slate-400 dark:text-gray-600">
          <span className="font-semibold text-slate-600 dark:text-gray-400">{stats.occupied}</span>
          <span>/{stats.total}</span>
        </span>
        {stats.failed > 0 && (
          <span className="text-[10px] font-medium text-red-500 dark:text-red-400">
            {stats.failed} FAIL
          </span>
        )}
        {stats.warn > 0 && (
          <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400">
            {stats.warn} WARN
          </span>
        )}
        {stats.failed === 0 && stats.warn === 0 && stats.occupied > 0 && (
          <span className="text-[10px] text-emerald-500 dark:text-emerald-400">All OK</span>
        )}
        {stats.avgTemp != null && (
          <span className="text-[10px] text-slate-400 dark:text-gray-600">
            avg <span className="font-semibold text-slate-500 dark:text-gray-500">{stats.avgTemp}°C</span>
          </span>
        )}
      </div>

      {/* Grid */}
      {!collapsed && (
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
                  isVdevPeer={
                    !!(highlightVdev && drive?.vdev_name === highlightVdev && bay.id !== selectedBayId)
                  }
                  onClick={onBayClick}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
