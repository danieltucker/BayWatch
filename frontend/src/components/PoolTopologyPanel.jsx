import { useEffect, useState } from 'react'
import { Database, ChevronDown, ChevronRight } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { getPoolHistory } from '../api/client'

const axisStyle = { fontSize: 8, fill: 'var(--wt-text-faint)' }

function smartCardStyle(status) {
  if (status === 'PASSED') return { borderColor: 'var(--wt-up-100)', background: 'var(--wt-up-50)', color: 'var(--wt-up-600)' }
  if (status === 'FAILED') return { borderColor: 'var(--wt-down-100)', background: 'var(--wt-down-50)', color: 'var(--wt-down-500)' }
  return { borderColor: 'var(--wt-border)', background: 'var(--wt-surface-2)', color: 'var(--wt-text-muted)' }
}

function smartDotStyle(status) {
  if (status === 'PASSED') return { background: 'var(--wt-up-500)' }
  if (status === 'FAILED') return { background: 'var(--wt-down-500)' }
  return { background: 'var(--wt-n-400)' }
}

function statePillStyle(state) {
  if (state === 'ONLINE')   return { background: 'color-mix(in oklch, var(--wt-up-500) 15%, transparent)', color: 'var(--wt-up-600)' }
  if (state === 'DEGRADED') return { background: 'color-mix(in oklch, var(--wt-warn-500) 15%, transparent)', color: 'var(--wt-warn-600)' }
  if (state === 'FAULTED' || state === 'OFFLINE') return { background: 'color-mix(in oklch, var(--wt-down-500) 15%, transparent)', color: 'var(--wt-down-500)' }
  return { background: 'var(--wt-surface-2)', color: 'var(--wt-text-muted)' }
}

function formatCap(bytes) {
  if (!bytes) return null
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)}T`
  return `${(bytes / 1e9).toFixed(0)}G`
}

export default function PoolTopologyPanel({ poolTopology, poolStats, driveMap, onDriveSelect }) {
  const [open, setOpen] = useState(
    () => localStorage.getItem('pool-topology-open') === 'true'
  )
  const [poolHistories, setPoolHistories] = useState({})

  useEffect(() => {
    if (!open || !poolTopology.length) return
    poolTopology.forEach(pool => {
      if (poolHistories[pool.name]) return
      getPoolHistory(pool.name, 30).then(h => {
        setPoolHistories(prev => ({ ...prev, [pool.name]: h }))
      }).catch(() => {})
    })
  }, [open, poolTopology])

  const pathMap = {}
  Object.values(driveMap).forEach(d => {
    if (d.device_path) pathMap[d.device_path] = d
    if (d.by_id_path) pathMap[d.by_id_path] = d
  })

  const statMap = Object.fromEntries(poolStats.map(p => [p.name, p]))

  function toggle() {
    const next = !open
    setOpen(next)
    localStorage.setItem('pool-topology-open', String(next))
  }

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-[var(--wt-surface-2)]"
        style={{ background: 'var(--wt-surface-2)' }}
      >
        <div className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: 'var(--wt-surface-3)' }}>
          <Database size={13} style={{ color: 'var(--wt-text-muted)' }} />
        </div>
        <h2 className="font-semibold text-sm flex-1 text-left" style={{ color: 'var(--wt-text)' }}>
          ZFS Pool Topology
        </h2>
        {open
          ? <ChevronDown size={14} style={{ color: 'var(--wt-text-faint)' }} />
          : <ChevronRight size={14} style={{ color: 'var(--wt-text-faint)' }} />
        }
      </button>

      {open && (
        <div className="p-4 flex flex-col gap-6" style={{ borderTop: '1px solid var(--wt-border)' }}>
          {poolTopology.map(pool => {
            const stat = statMap[pool.name]
            const usedPct = stat?.capacity_pct ?? null

            return (
              <div key={pool.name} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: 'var(--wt-text)' }}>{pool.name}</span>
                    <span className="wt-mono text-[9px] font-bold px-1.5 py-0.5 rounded" style={statePillStyle(pool.state)}>
                      {pool.state}
                    </span>
                    {usedPct != null && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="wt-meter flex-1">
                          <div className="wt-meter__fill" style={{
                            width: `${Math.min(100, usedPct)}%`,
                            background: usedPct >= 80 ? 'var(--wt-warn-500)' : 'var(--wt-brand-500)',
                          }} />
                        </div>
                        <span className="wt-mono text-[9px] shrink-0" style={{ color: 'var(--wt-text-muted)' }}>{usedPct}%</span>
                      </div>
                    )}
                  </div>
                  {pool.scan_status && pool.scan_status !== 'none requested' && (
                    <p className="wt-mono text-[9px] leading-tight truncate" style={{ color:
                      /error|fault|degraded/i.test(pool.scan_status) ? 'var(--wt-warn-600)' : 'var(--wt-text-faint)'
                    }}>
                      {pool.scan_status}
                    </p>
                  )}
                </div>

                {/* Pool capacity history */}
                {(() => {
                  const h = (poolHistories[pool.name] || []).filter(r => r.capacity_pct != null)
                  if (h.length < 2) return null
                  const chartData = h.map(r => ({
                    date: new Date(r.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    pct: r.capacity_pct,
                  }))
                  return (
                    <div>
                      <p className="wt-eyebrow mb-1">Capacity (30d)</p>
                      <ResponsiveContainer width="100%" height={56}>
                        <AreaChart data={chartData} margin={{ top: 2, right: 4, bottom: 0, left: -24 }}>
                          <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                          <Tooltip
                            contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}
                            formatter={v => [`${v}%`, 'Used']}
                            labelStyle={{ color: '#94a3b8' }}
                          />
                          <Area type="monotone" dataKey="pct" stroke="#3b82f6" fill="#3b82f622" strokeWidth={1.5} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })()}

                {/* vdev rows */}
                <div className="flex flex-col gap-2.5">
                  {pool.vdevs.map(vdev => (
                    <div key={vdev.name} className="flex items-start gap-2 flex-wrap">
                      <span className="wt-mono text-[9px] px-1.5 py-1 rounded shrink-0 leading-none mt-0.5"
                        style={{ background: 'var(--wt-surface-2)', color: 'var(--wt-text-muted)', border: '1px solid var(--wt-border)' }}>
                        {vdev.name}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {vdev.disks.map(disk => {
                          const drive = pathMap[disk.path] ?? pathMap[disk.path.replace(/-part\d+$/, '')]
                          const cardStyle = drive
                            ? smartCardStyle(drive.smart_status)
                            : { borderColor: 'var(--wt-border)', background: 'var(--wt-surface-2)', color: 'var(--wt-text-faint)' }
                          return (
                            <button
                              key={disk.path}
                              onClick={() => drive && onDriveSelect?.(drive.serial)}
                              title={disk.path}
                              className="flex flex-col items-start px-2 py-2 rounded-lg border text-left transition-all w-[120px] shrink-0"
                              style={{ ...cardStyle, cursor: drive ? 'pointer' : 'default' }}
                            >
                              <div className="flex items-center justify-between w-full gap-1">
                                <span className="wt-mono text-[9px] font-semibold leading-none truncate">
                                  {drive
                                    ? drive.serial.slice(-6)
                                    : disk.path.split('/').pop()?.slice(-6) ?? '?'
                                  }
                                </span>
                                {drive && (
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={smartDotStyle(drive.smart_status)} />
                                )}
                              </div>
                              {(drive?.make || drive?.model) && (
                                <span className="text-[8px] leading-none mt-1 truncate w-full opacity-60">
                                  {drive.make || drive.model}
                                </span>
                              )}
                              <div className="flex items-center justify-between w-full mt-1 gap-1">
                                {drive?.capacity_bytes && (
                                  <span className="wt-mono text-[8px] leading-none opacity-50">
                                    {formatCap(drive.capacity_bytes)}
                                  </span>
                                )}
                                {drive?.temperature_c != null && (
                                  <span className="wt-mono text-[8px] leading-none ml-auto" style={{
                                    color: drive.temperature_c >= 55 ? 'var(--wt-warn-600)' : undefined,
                                    opacity: drive.temperature_c >= 55 ? 1 : 0.5,
                                  }}>
                                    {drive.temperature_c}°
                                  </span>
                                )}
                              </div>
                              {(disk.read_errors > 0 || disk.write_errors > 0 || disk.cksum_errors > 0) && (
                                <div className="flex items-center gap-1 w-full mt-1">
                                  <span className="wt-mono text-[8px]" style={{ color: 'var(--wt-down-500)' }}>
                                    R:{disk.read_errors} W:{disk.write_errors} C:{disk.cksum_errors}
                                  </span>
                                </div>
                              )}
                              {!drive && (
                                <span className="wt-mono text-[8px] leading-none mt-1 opacity-50">
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
