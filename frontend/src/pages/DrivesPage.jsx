import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, HardDrive } from 'lucide-react'
import { getDriveIcon } from '../utils/driveIcon'

function fmtCap(bytes) {
  if (!bytes) return '—'
  return bytes >= 1e12 ? `${(bytes / 1e12).toFixed(1)} TB` : `${(bytes / 1e9).toFixed(0)} GB`
}

function fmtHours(h) {
  if (h == null) return '—'
  if (h >= 8760) return `${(h / 8760).toFixed(1)}y`
  if (h >= 720) return `${(h / 720).toFixed(1)}mo`
  return `${h.toLocaleString()}h`
}

function SmartDot({ status }) {
  const color =
    status === 'PASSED' ? 'var(--wt-up-500)' :
    status === 'FAILED' ? 'var(--wt-down-500)' :
    'var(--wt-n-400)'
  return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ background: color }} />
}

const COLS = [
  { key: 'make', label: 'Drive' },
  { key: 'serial', label: 'Serial' },
  { key: 'drive_type', label: 'Type' },
  { key: 'smart_status', label: 'SMART' },
  { key: 'zfs_checksum_errors', label: 'ZFS Errors' },
  { key: 'temperature_c', label: 'Temp' },
  { key: 'power_on_hours', label: 'Age' },
  { key: 'capacity_bytes', label: 'Capacity' },
  { key: 'zfs_pool', label: 'Pool' },
  { key: 'bay', label: 'Bay' },
]

export default function DrivesPage({ drives = [], profiles = [], enclosures = [], baysMap = {} }) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('make')
  const [sortDir, setSortDir] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('all')

  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))

  const bayLocMap = useMemo(() => {
    const m = {}
    for (const enc of enclosures) {
      for (const arr of enc.arrays || []) {
        for (const bay of baysMap[arr.id] || []) {
          if (bay.drive_serial) {
            m[bay.drive_serial] = {
              enclosure: enc.name,
              array: arr.name,
              bay: bay.label || `R${bay.row + 1}C${bay.col + 1}`,
            }
          }
        }
      }
    }
    return m
  }, [enclosures, baysMap])

  function getVal(d, key) {
    if (key === 'make') return [d.make, d.model].filter(Boolean).join(' ') || d.serial
    if (key === 'bay') {
      const loc = bayLocMap[d.serial]
      return loc ? `${loc.enclosure} › ${loc.array} › ${loc.bay}` : ''
    }
    return d[key] ?? ''
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return drives.filter(d => {
      if (statusFilter === 'passed' && d.smart_status !== 'PASSED') return false
      if (statusFilter === 'failed' && d.smart_status !== 'FAILED') return false
      if (statusFilter === 'errors' && !((d.reallocated_sectors || 0) > 0 || (d.uncorrectable_errors || 0) > 0 || (d.zfs_checksum_errors || 0) > 0 || (d.zfs_write_errors || 0) > 0)) return false
      if (!q) return true
      return (
        d.serial.toLowerCase().includes(q) ||
        (d.make || '').toLowerCase().includes(q) ||
        (d.model || '').toLowerCase().includes(q) ||
        (d.zfs_pool || '').toLowerCase().includes(q)
      )
    })
  }, [drives, search, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = getVal(a, sortCol)
      const bv = getVal(b, sortCol)
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <ChevronUp size={11} style={{ opacity: 0.3 }} />
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 flex-wrap" style={{ borderBottom: '1px solid var(--wt-border)' }}>
        <div>
          <h1 className="font-bold" style={{ fontSize: 'var(--wt-text-xl)', color: 'var(--wt-text)', letterSpacing: '-0.02em' }}>Drives</h1>
          <p className="wt-mono text-xs mt-0.5" style={{ color: 'var(--wt-text-faint)' }}>{drives.length} drives</p>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--wt-text-faint)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drives…"
              className="wt-input w-full pl-7 text-sm"
            />
          </div>
          <div className="wt-seg">
            {[
              { key: 'all', label: 'All' },
              { key: 'passed', label: 'Passed' },
              { key: 'failed', label: 'Failed' },
              { key: 'errors', label: 'Errors' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setStatusFilter(key)} aria-selected={statusFilter === key}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3" style={{ color: 'var(--wt-text-faint)' }}>
          <HardDrive size={28} />
          <p className="text-sm">No drives match your filter</p>
        </div>
      ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0" style={{ background: 'var(--wt-surface-2)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--wt-border)' }}>
                {COLS.map(({ key, label }) => (
                  <th
                    key={key}
                    className="text-left px-4 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none"
                    style={{ color: 'var(--wt-text-muted)' }}
                    onClick={() => toggleSort(key)}
                  >
                    <span className="flex items-center gap-1">
                      {label} <SortIcon col={key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => {
                const DriveIcon = getDriveIcon(d.form_factor, d.rpm)
                const loc = bayLocMap[d.serial]
                const smartOk = d.smart_status === 'PASSED'
                const smartFail = d.smart_status === 'FAILED'
                const hasErrors = (d.reallocated_sectors || 0) > 0 || (d.uncorrectable_errors || 0) > 0
                return (
                  <tr
                    key={d.serial}
                    style={{ borderBottom: '1px solid var(--wt-border)' }}
                    className="transition-colors hover:bg-[var(--wt-surface-2)]"
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <SmartDot status={d.smart_status} />
                        <DriveIcon size={14} style={{ color: smartFail ? 'var(--wt-down-500)' : hasErrors ? 'var(--wt-warn-500)' : smartOk ? 'var(--wt-up-500)' : 'var(--wt-text-faint)' }} />
                        <div className="min-w-0">
                          <p className="font-medium truncate" style={{ color: 'var(--wt-text)' }}>
                            {[d.make, d.model].filter(Boolean).join(' ') || '—'}
                          </p>
                          {!d.is_connected && (
                            <p className="text-[10px]" style={{ color: 'var(--wt-warn-600)' }}>Disconnected</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>{d.serial}</code>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: 'var(--wt-text-muted)' }}>
                      {d.drive_type || d.form_factor || '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="wt-mono text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={smartOk
                          ? { background: 'var(--wt-up-50)', border: '1px solid var(--wt-up-100)', color: 'var(--wt-up-700)' }
                          : smartFail
                          ? { background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)', color: 'var(--wt-down-700)' }
                          : { background: 'var(--wt-surface-2)', border: '1px solid var(--wt-border)', color: 'var(--wt-text-muted)' }
                        }>
                        {d.smart_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {(() => {
                        const cksum = d.zfs_checksum_errors ?? 0
                        const wrerr = d.zfs_write_errors ?? 0
                        const rderr = d.zfs_read_errors ?? 0
                        const total = cksum + wrerr + rderr
                        if (total === 0) return <span className="wt-mono text-xs" style={{ color: 'var(--wt-text-faint)' }}>—</span>
                        const isCrit = cksum >= 50 || wrerr > 0
                        return (
                          <span className="wt-mono text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={isCrit
                              ? { background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)', color: 'var(--wt-down-700)' }
                              : { background: 'var(--wt-warn-50)', border: '1px solid var(--wt-warn-200)', color: 'var(--wt-warn-700)' }
                            }
                            title={`Checksum: ${cksum} · Read: ${rderr} · Write: ${wrerr}`}>
                            {cksum > 0 ? `${cksum}C` : ''}{wrerr > 0 ? ` ${wrerr}W` : ''}{rderr > 0 ? ` ${rderr}R` : ''}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-2.5 wt-mono text-xs whitespace-nowrap"
                      style={{ color: (d.temperature_c >= 65) ? 'var(--wt-down-500)' : (d.temperature_c >= 55) ? 'var(--wt-warn-500)' : 'var(--wt-text-muted)' }}>
                      {d.temperature_c != null ? `${d.temperature_c}°C` : '—'}
                    </td>
                    <td className="px-4 py-2.5 wt-mono text-xs whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>
                      {fmtHours(d.power_on_hours)}
                    </td>
                    <td className="px-4 py-2.5 wt-mono text-xs whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>
                      {fmtCap(d.capacity_bytes)}
                    </td>
                    <td className="px-4 py-2.5 wt-mono text-xs whitespace-nowrap" style={{ color: d.zfs_pool ? 'var(--wt-brand-500)' : 'var(--wt-text-faint)' }}>
                      {d.zfs_pool || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--wt-text-faint)' }}>
                      {loc ? `${loc.enclosure} › ${loc.bay}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
