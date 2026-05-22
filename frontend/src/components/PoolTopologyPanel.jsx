import { useState } from 'react'
import { Database, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

function smartColor(status) {
  if (status === 'PASSED') return 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400'
  if (status === 'FAILED') return 'border-red-500/60 bg-red-950/20 text-red-400'
  return 'border-slate-600/50 bg-slate-800/20 text-slate-400'
}

function smartDot(status) {
  if (status === 'PASSED') return 'bg-emerald-400'
  if (status === 'FAILED') return 'bg-red-400'
  return 'bg-slate-500'
}

function formatCap(bytes) {
  if (!bytes) return null
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)}T`
  return `${(bytes / 1e9).toFixed(0)}G`
}

function stateColor(state) {
  if (state === 'ONLINE')  return 'bg-emerald-500/20 text-emerald-400'
  if (state === 'DEGRADED') return 'bg-amber-500/20 text-amber-400'
  if (state === 'FAULTED' || state === 'OFFLINE') return 'bg-red-500/20 text-red-400'
  return 'bg-slate-500/20 text-slate-400'
}

export default function PoolTopologyPanel({ poolTopology, poolStats, driveMap, onDriveSelect }) {
  const [open, setOpen] = useState(
    () => localStorage.getItem('pool-topology-open') === 'true'
  )

  const pathMap = Object.fromEntries(
    Object.values(driveMap)
      .filter(d => d.device_path)
      .map(d => [d.device_path, d])
  )

  const statMap = Object.fromEntries(poolStats.map(p => [p.name, p]))

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('pool-topology-open', String(next))
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900/50 border border-slate-200 dark:border-gray-800/60 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-slate-50 dark:bg-gray-900/80 hover:bg-slate-100 dark:hover:bg-gray-800/40 transition-colors"
      >
        <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
          <Database size={13} className="text-slate-500 dark:text-gray-400" />
        </div>
        <h2 className="font-semibold text-slate-800 dark:text-gray-200 text-sm flex-1 text-left">
          ZFS Pool Topology
        </h2>
        {open
          ? <ChevronDown size={14} className="text-slate-400 dark:text-gray-600" />
          : <ChevronRight size={14} className="text-slate-400 dark:text-gray-600" />
        }
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-gray-800/60 p-4 flex flex-col gap-6">
          {poolTopology.map(pool => {
            const stat = statMap[pool.name]
            const usedPct = stat?.capacity_pct ?? null

            return (
              <div key={pool.name} className="flex flex-col gap-3">
                {/* Pool header */}
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 dark:text-gray-200 text-sm">{pool.name}</span>
                  <span className={clsx('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded', stateColor(pool.state))}>
                    {pool.state}
                  </span>
                  {usedPct != null && (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-gray-800 overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all', usedPct >= 80 ? 'bg-amber-400' : 'bg-blue-400')}
                          style={{ width: `${Math.min(100, usedPct)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 dark:text-gray-500 shrink-0">{usedPct}%</span>
                    </div>
                  )}
                </div>

                {/* vdev rows */}
                <div className="flex flex-col gap-2.5">
                  {pool.vdevs.map(vdev => (
                    <div key={vdev.name} className="flex items-start gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-slate-500 dark:text-gray-500 bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 px-1.5 py-1 rounded shrink-0 leading-none mt-0.5">
                        {vdev.name}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {vdev.disks.map(disk => {
                          const drive = pathMap[disk.path]
                          return (
                            <button
                              key={disk.path}
                              onClick={() => drive && onDriveSelect?.(drive.serial)}
                              title={disk.path}
                              className={clsx(
                                'flex flex-col items-start px-2 py-2 rounded-lg border text-left transition-all w-[120px] shrink-0',
                                drive
                                  ? clsx(smartColor(drive.smart_status), 'hover:opacity-75 cursor-pointer')
                                  : 'border-slate-300 dark:border-slate-700/50 bg-slate-50 dark:bg-gray-800/20 text-slate-400 cursor-default'
                              )}
                            >
                              {/* Serial + SMART dot */}
                              <div className="flex items-center justify-between w-full gap-1">
                                <span className="text-[9px] font-mono font-semibold leading-none truncate">
                                  {drive
                                    ? drive.serial.slice(-6)
                                    : disk.path.split('/').pop()?.slice(-6) ?? '?'
                                  }
                                </span>
                                {drive && (
                                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', smartDot(drive.smart_status))} />
                                )}
                              </div>
                              {/* Model */}
                              {drive?.model && (
                                <span className="text-[8px] leading-none mt-1 truncate w-full opacity-60">
                                  {drive.model}
                                </span>
                              )}
                              {/* Capacity + temp row */}
                              <div className="flex items-center justify-between w-full mt-1 gap-1">
                                {drive?.capacity_bytes && (
                                  <span className="text-[8px] font-mono leading-none opacity-50">
                                    {formatCap(drive.capacity_bytes)}
                                  </span>
                                )}
                                {drive?.temperature_c != null && (
                                  <span className={clsx(
                                    'text-[8px] font-mono leading-none ml-auto',
                                    drive.temperature_c >= 55 ? 'text-amber-400' : 'opacity-50'
                                  )}>
                                    {drive.temperature_c}°
                                  </span>
                                )}
                              </div>
                              {!drive && (
                                <span className="text-[8px] font-mono leading-none mt-1 opacity-50">
                                  {disk.state}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
