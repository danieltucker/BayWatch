import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import BaySlot from './BaySlot'
import { getArrayTempHistory } from '../api/client'
import { useTempThresholds } from '../context/TempThresholdContext'

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
  return { total, occupied, avgTemp, passed, failed, warn, empty: total - occupied }
}

function ArrayTempSparkline({ arrayId }) {
  const [data, setData] = useState([])
  const { warnC, dangerC } = useTempThresholds()

  useEffect(() => {
    getArrayTempHistory(arrayId).then(setData).catch(() => {})
  }, [arrayId])

  if (data.length < 2) return null

  const latest = data[data.length - 1]?.avg_temp_c ?? 0
  const color = latest >= dangerC ? '#f87171' : latest >= warnC ? '#fbbf24' : '#38bdf8'

  return (
    <div className="w-full h-7">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`tg-${arrayId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="avg_temp_c"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#tg-${arrayId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function HealthBar({ stats }) {
  return (
    <div className="flex h-[3px] w-full rounded-full overflow-hidden">
      {stats.passed > 0 && <div className="bg-emerald-400 dark:bg-emerald-500" style={{ flex: stats.passed }} />}
      {stats.warn > 0 && <div className="bg-amber-400" style={{ flex: stats.warn }} />}
      {stats.failed > 0 && <div className="bg-red-400" style={{ flex: stats.failed }} />}
      {stats.empty > 0 && <div className="bg-slate-200 dark:bg-gray-800" style={{ flex: stats.empty }} />}
    </div>
  )
}

export default function BayGrid({
  array, bays, driveMap, profileMap, selectedBayId, onBayClick, highlightVdev,
  onMoveUp, onMoveDown, onBayHover, onBayHoverEnd,
}) {
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
  const showReorder = onMoveUp !== undefined || onMoveDown !== undefined

  return (
    <div className="w-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 mb-2">
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 shrink-0 transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Name + badges */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
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

        {/* Right controls: reorder + size toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {showReorder && (
            <div className="flex gap-0.5">
              <button
                onClick={onMoveUp}
                disabled={!onMoveUp}
                className={clsx(
                  'p-0.5 rounded transition-colors',
                  onMoveUp
                    ? 'text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                    : 'text-slate-200 dark:text-gray-800 cursor-not-allowed'
                )}
              >
                <ArrowUp size={12} />
              </button>
              <button
                onClick={onMoveDown}
                disabled={!onMoveDown}
                className={clsx(
                  'p-0.5 rounded transition-colors',
                  onMoveDown
                    ? 'text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800'
                    : 'text-slate-200 dark:text-gray-800 cursor-not-allowed'
                )}
              >
                <ArrowDown size={12} />
              </button>
              <div className="w-px h-4 bg-slate-200 dark:bg-gray-700/60 mx-0.5 self-center" />
            </div>
          )}

          <div className="flex rounded-md border border-slate-200 dark:border-gray-700/60 overflow-hidden">
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
      </div>

      {/* ── Stats strip ── */}
      <div className="flex flex-col gap-1 mb-3 px-0.5">
        <HealthBar stats={stats} />
        <ArrayTempSparkline arrayId={array.id} />
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400 dark:text-gray-600">
            <span className="font-semibold text-slate-600 dark:text-gray-400">{stats.occupied}</span>
            <span>/{stats.total}</span>
          </span>
          {stats.failed > 0 && (
            <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">
              {stats.failed} {stats.failed === 1 ? 'failure' : 'failures'}
            </span>
          )}
          {stats.warn > 0 && (
            <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400">
              {stats.warn} degraded
            </span>
          )}
          {stats.failed === 0 && stats.warn === 0 && stats.occupied > 0 && (
            <span className="text-[10px] text-emerald-500 dark:text-emerald-400">All healthy</span>
          )}
          {stats.avgTemp != null && (
            <span className="text-[10px] text-slate-400 dark:text-gray-600 ml-auto">
              avg <span className="font-semibold text-slate-500 dark:text-gray-400">{stats.avgTemp}°C</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
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
                  onHover={onBayHover}
                  onHoverEnd={onBayHoverEnd}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
