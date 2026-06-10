import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, HardDrive, Pencil, X, Save } from 'lucide-react'
import { getDriveIcon } from '../utils/driveIcon'
import { upsertProfile } from '../api/client'

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

function BulkEditModal({ serials, onClose, onSaved }) {
  const [form, setForm] = useState({ vendor: '', purchase_date: '', warranty_years: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {}
      if (form.vendor.trim()) payload.vendor = form.vendor.trim()
      if (form.purchase_date) payload.purchase_date = form.purchase_date
      if (form.warranty_years !== '') payload.warranty_months = Math.round(parseFloat(form.warranty_years) * 12)
      if (form.notes.trim()) payload.notes = form.notes.trim()

      if (!Object.keys(payload).length) { onClose(); return }

      await Promise.all(serials.map(s => upsertProfile(s, payload)))
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
          style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>

          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--wt-border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--wt-surface-2)' }}>
                <Pencil size={14} style={{ color: 'var(--wt-brand-500)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>Edit {serials.length} drives</p>
                <p className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>Only filled fields will be updated</p>
              </div>
            </div>
            <button onClick={onClose}
              className="transition-colors p-1 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <p className="wt-eyebrow">Ownership</p>

            <div className="wt-field">
              <label className="wt-label">Vendor</label>
              <input type="text" value={form.vendor} onChange={e => set('vendor', e.target.value)}
                placeholder="e.g. Amazon, CDW" className="wt-input" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="wt-field">
                <label className="wt-label">Purchase Date</label>
                <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)}
                  className="wt-input" />
              </div>
              <div className="wt-field">
                <label className="wt-label">Warranty (years)</label>
                <input type="number" step="0.5" value={form.warranty_years} onChange={e => set('warranty_years', e.target.value)}
                  placeholder="e.g. 3" className="wt-input" />
              </div>
            </div>

            <div className="wt-field">
              <label className="wt-label">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                placeholder="Notes to apply to all selected drives…"
                className="wt-textarea resize-none" />
            </div>

            {error && (
              <p className="text-xs rounded px-3 py-2 border"
                style={{ color: 'var(--wt-down-600)', background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="wt-btn wt-btn--ghost">Cancel</button>
              <button type="submit" disabled={saving} className="wt-btn wt-btn--primary disabled:opacity-50">
                <Save size={14} /> {saving ? 'Saving…' : `Save to ${serials.length} drives`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

const COLS = [
  { key: 'make', label: 'Drive' },
  { key: 'serial', label: 'Serial' },
  { key: 'drive_type', label: 'Type' },
  { key: 'smart_status', label: 'SMART' },
  { key: 'temperature_c', label: 'Temp' },
  { key: 'power_on_hours', label: 'Age' },
  { key: 'capacity_bytes', label: 'Capacity' },
  { key: 'zfs_pool', label: 'Pool' },
  { key: 'bay', label: 'Bay' },
]

export default function DrivesPage({ drives = [], profiles = [], enclosures = [], baysMap = {}, onSaved }) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('make')
  const [sortDir, setSortDir] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

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
      if (statusFilter === 'errors' && !((d.reallocated_sectors || 0) > 0 || (d.uncorrectable_errors || 0) > 0)) return false
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

  const allVisibleSerials = sorted.map(d => d.serial)
  const allSelected = allVisibleSerials.length > 0 && allVisibleSerials.every(s => selected.has(s))
  const someSelected = !allSelected && allVisibleSerials.some(s => selected.has(s))

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        allVisibleSerials.forEach(s => next.delete(s))
        return next
      })
    } else {
      setSelected(prev => new Set([...prev, ...allVisibleSerials]))
    }
  }

  function toggleOne(serial) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(serial) ? next.delete(serial) : next.add(serial)
      return next
    })
  }

  const selectedCount = selected.size

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

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="px-6 py-2.5 flex items-center gap-3" style={{ background: 'color-mix(in oklch, var(--wt-brand-500) 8%, transparent)', borderBottom: '1px solid var(--wt-border)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--wt-brand-600)' }}>
            {selectedCount} drive{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button onClick={() => setBulkEditOpen(true)} className="wt-btn wt-btn--primary wt-btn--sm">
            <Pencil size={12} /> Edit attributes
          </button>
          <button onClick={() => setSelected(new Set())} className="wt-btn wt-btn--ghost wt-btn--sm">
            <X size={12} /> Clear selection
          </button>
        </div>
      )}

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
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleAll}
                    className="rounded cursor-pointer"
                    style={{ accentColor: 'var(--wt-brand-500)' }}
                  />
                </th>
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
                const isSelected = selected.has(d.serial)
                return (
                  <tr
                    key={d.serial}
                    style={{
                      borderBottom: '1px solid var(--wt-border)',
                      background: isSelected ? 'color-mix(in oklch, var(--wt-brand-500) 6%, transparent)' : undefined,
                    }}
                    className="transition-colors hover:bg-[var(--wt-surface-2)]"
                  >
                    <td className="pl-4 pr-2 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(d.serial)}
                        className="rounded cursor-pointer"
                        style={{ accentColor: 'var(--wt-brand-500)' }}
                      />
                    </td>
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

      {bulkEditOpen && (
        <BulkEditModal
          serials={[...selected]}
          onClose={() => setBulkEditOpen(false)}
          onSaved={() => { setSelected(new Set()); onSaved?.() }}
        />
      )}
    </div>
  )
}
