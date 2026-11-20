import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Pencil, Search } from 'lucide-react'
import AppHeader from '../components/shell/AppHeader'
import Dialog from '../components/ui/Dialog'
import { Led, SmartPill, Spinner } from '../components/ui/bits'
import { useFleet } from '../context/FleetContext'
import { useTempThresholds } from '../context/TempThresholdContext'
import { useIsMobile } from '../hooks/useMediaQuery'
import { upsertProfile } from '../api/client'
import { driveStatus, hasErrorCounters, isSpare, placementLabel, tempBand } from '../lib/fleet'
import { driveName, fmtAge, fmtCap, formFactorLabel } from '../lib/format'
import { exportDrivesCSV } from '../lib/export'

const FILTERS = {
  all: { label: 'All', test: () => true },
  passed: { label: 'Passed', test: d => d.smart_status === 'PASSED' },
  errors: { label: 'Errors', test: d => hasErrorCounters(d) },
  unknown: { label: 'Unknown', test: d => d.smart_status !== 'PASSED' && d.smart_status !== 'FAILED' },
  disconnected: { label: 'Disconnected', test: d => d.is_connected === false },
  failed: { label: 'Failed', test: d => d.smart_status === 'FAILED' },
}

const zfsErrors = d => (d.zfs_read_errors || 0) + (d.zfs_write_errors || 0) + (d.zfs_checksum_errors || 0)

const COLS = [
  { key: 'name', label: 'Drive', get: d => driveName(d).toLowerCase() },
  { key: 'serial', label: 'Serial', get: d => d.serial },
  { key: 'type', label: 'Type', get: d => d.form_factor || '' },
  { key: 'smart', label: 'SMART', get: d => d.smart_status },
  { key: 'zfs', label: 'ZFS errors', get: d => zfsErrors(d) },
  { key: 'temp', label: 'Temp', get: d => d.temperature_c },
  { key: 'age', label: 'Age', get: d => d.power_on_hours },
  { key: 'cap', label: 'Capacity', get: d => d.capacity_bytes },
  { key: 'pool', label: 'Pool', get: d => d.zfs_pool || '' },
  { key: 'bay', label: 'Bay', get: (d, ctx) => placementLabel(ctx.placement[d.serial]) || '' },
]

function BulkEditDialog({ serials, onClose, onSaved }) {
  const [form, setForm] = useState({ vendor: '', purchase_date: '', warranty_years: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    const payload = {}
    if (form.vendor.trim()) payload.vendor = form.vendor.trim()
    if (form.purchase_date) payload.purchase_date = form.purchase_date
    if (form.warranty_years !== '') payload.warranty_months = Math.round(parseFloat(form.warranty_years) * 12)
    if (form.notes.trim()) payload.notes = form.notes.trim()
    if (!Object.keys(payload).length) { onClose(); return }
    setSaving(true); setError(null)
    try {
      await Promise.all(serials.map(s => upsertProfile(s, payload)))
      await onSaved?.()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog title={`Edit ${serials.length} drives`} subtitle="Only filled fields are updated." onClose={onClose} width={480}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="wt-field"><span className="wt-label">Vendor</span>
          <input className="wt-input" value={form.vendor} placeholder="e.g. Amazon, CDW" onChange={e => set('vendor', e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="wt-field"><span className="wt-label">Purchased</span>
            <input type="date" className="wt-input wt-input--mono" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
          </label>
          <label className="wt-field"><span className="wt-label">Warranty, years</span>
            <input type="number" step="0.5" min="0" className="wt-input wt-input--mono" value={form.warranty_years} placeholder="e.g. 3" onChange={e => set('warranty_years', e.target.value)} />
          </label>
        </div>
        <label className="wt-field"><span className="wt-label">Notes</span>
          <textarea rows={3} className="wt-textarea" value={form.notes} placeholder="Notes to apply to all selected drives" onChange={e => set('notes', e.target.value)} />
        </label>
        {error && <p className="wt-pill wt-pill--down" role="alert" style={{ borderRadius: 'var(--wt-r-md)', padding: '8px 12px' }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="wt-btn wt-btn--secondary bw-btn-lg" onClick={onClose}>Cancel</button>
          <button type="submit" className="wt-btn wt-btn--primary bw-btn-lg disabled:opacity-60" disabled={saving}>
            {saving ? 'Saving…' : `Save to ${serials.length} drives`}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function TempCell({ t, thresholds }) {
  if (t == null) return <span style={{ color: 'var(--wt-text-faint)' }}>—</span>
  const band = tempBand(t, thresholds)
  return <span className="wt-mono" style={band === 'warn' || band === 'down' ? { color: `var(--wt-${band}-600)`, fontWeight: 600 } : undefined}>{t}°C</span>
}

function DriveDot({ d }) {
  return <Led status={driveStatus(d)} hollow={d.is_connected === false} />
}

export default function DrivesPage() {
  const fleet = useFleet()
  const thresholds = useTempThresholds()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState(() => new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  const q = params.get('q') || ''
  const f = FILTERS[params.get('status')] ? params.get('status') : 'all'
  const sortKey = COLS.some(c => c.key === params.get('sort')) ? params.get('sort') : 'name'
  const dir = params.get('dir') === 'desc' ? -1 : 1
  const setParam = (k, v) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })

  const { drives, placement, profileMap, locations } = fleet
  const ctx = { placement }

  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, v]) => [k, drives.filter(v.test).length])), [drives])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const col = COLS.find(c => c.key === sortKey)
    return drives
      .filter(FILTERS[f].test)
      .filter(d => !needle || [driveName(d), d.serial, d.zfs_pool, d.vdev_name, placementLabel(placement[d.serial])].filter(Boolean).join(' ').toLowerCase().includes(needle))
      .sort((a, b) => {
        const x = col.get(a, ctx), y = col.get(b, ctx)
        if (x == null && y == null) return 0
        if (x == null) return 1
        if (y == null) return -1
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drives, q, f, sortKey, dir, placement])

  const encCount = locations.filter(l => !l.remote).length
  const allSel = rows.length > 0 && rows.every(d => selected.has(d.serial))
  const toggleAll = () => setSelected(prev => {
    const n = new Set(prev)
    if (allSel) rows.forEach(d => n.delete(d.serial)); else rows.forEach(d => n.add(d.serial))
    return n
  })
  const toggleOne = s => setSelected(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })
  const sortLabel = `${COLS.find(c => c.key === sortKey).label.toLowerCase()}, ${dir === 1 ? 'ascending' : 'descending'}`

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <label className="bw-search" style={{ flex: '1 1 260px', maxWidth: isMobile ? undefined : 420, background: 'var(--wt-surface)', borderColor: 'var(--wt-border-strong)', color: 'var(--wt-text-subtle)' }}>
        <Search size={16} aria-hidden="true" />
        <span className="sr-only-bw">Filter drives</span>
        <input type="search" value={q} placeholder="Filter by name, serial, pool or bay" style={{ color: 'var(--wt-text)' }}
          onChange={e => setParam('q', e.target.value)} />
      </label>
      <div role="group" aria-label="Filter by status" className={isMobile ? 'bw-locs' : 'flex flex-wrap gap-1.5'}>
        {Object.entries(FILTERS).map(([k, v]) => (
          (k === 'all' || counts[k] > 0 || f === k) && (
            <button key={k} type="button" className="bw-chipbtn" style={{ flex: 'none' }} aria-pressed={f === k} onClick={() => setParam('status', k === 'all' ? '' : k)}>
              {v.label} <span className="wt-mono">{counts[k]}</span>
            </button>
          )
        ))}
      </div>
    </div>
  )

  return (
    <div className="bw-page" data-screen-label="Drives">
      <AppHeader />
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <span className="wt-eyebrow">Inventory</span>
          <h1 className="bw-h1 mt-1.5">Drives</h1>
          <div className="bw-sub">
            <span className="wt-mono">{drives.length}</span> drives across <span className="wt-mono">{encCount}</span> {encCount === 1 ? 'enclosure' : 'enclosures'}
          </div>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && !isMobile && (
            <>
              <button type="button" className="wt-btn wt-btn--primary" style={{ minHeight: 40 }} onClick={() => setBulkOpen(true)}>
                <Pencil size={14} aria-hidden="true" /> Edit {selected.size} selected
              </button>
              <button type="button" className="wt-btn wt-btn--ghost" style={{ minHeight: 40 }} onClick={() => setSelected(new Set())}>Clear</button>
            </>
          )}
          <button type="button" className="wt-btn wt-btn--secondary" style={{ minHeight: 40 }} disabled={!drives.length}
            onClick={() => exportDrivesCSV(rows, profileMap, placement)}>
            <Download size={14} aria-hidden="true" /> Export
          </button>
        </div>
      </div>
      {toolbar}

      {fleet.loading ? <Spinner /> : isMobile ? (
        <div className="flex flex-col gap-2.5" aria-label="Drives">
          {rows.map(d => (
            <Link key={d.serial} to={`/drives/${encodeURIComponent(d.serial)}`} className="bw-card flex flex-col gap-2" style={{ padding: '14px 16px', color: 'var(--wt-text)', textDecoration: 'none' }}>
              <div className="flex justify-between items-start gap-2.5">
                <div className="min-w-0 flex items-start gap-2.5">
                  <span className="mt-1.5"><DriveDot d={d} /></span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{driveName(d)}</div>
                    <div className="wt-mono text-xs mt-0.5" style={{ color: 'var(--wt-text-muted)' }}>{d.serial}</div>
                  </div>
                </div>
                <SmartPill status={d.smart_status} />
              </div>
              <div className="flex gap-4 text-[13px]">
                <span><span style={{ color: 'var(--wt-text-muted)' }}>Temp</span> <TempCell t={d.temperature_c} thresholds={thresholds} /></span>
                <span><span style={{ color: 'var(--wt-text-muted)' }}>Age</span> <span className="wt-mono">{fmtAge(d.power_on_hours)}</span></span>
                <span><span style={{ color: 'var(--wt-text-muted)' }}>Size</span> <span className="wt-mono">{fmtCap(d.capacity_bytes)}</span></span>
              </div>
              <div className="flex justify-between gap-2.5 text-[13px]">
                <span className="truncate" style={{ color: 'var(--wt-text-muted)' }}>{placementLabel(placement[d.serial]) || 'Not in a bay'}</span>
                {d.zfs_pool && <span className="wt-mono" style={{ color: 'var(--wt-text)' }}>{d.zfs_pool}</span>}
              </div>
              {d.is_connected === false && <span className="wt-pill wt-pill--muted self-start">Disconnected</span>}
            </Link>
          ))}
          {!rows.length && <div className="bw-card bw-card--pad text-center bw-sub">No drives match these filters.</div>}
        </div>
      ) : (
        <div className="bw-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="bw-table" style={{ minWidth: 1120 }}>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>
                    <input type="checkbox" checked={allSel} onChange={toggleAll} aria-label="Select all shown drives" className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--bw-ink)' }} />
                  </th>
                  {COLS.map(c => (
                    <th key={c.key} aria-sort={sortKey === c.key ? (dir === 1 ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="bw-sort" aria-label={`Sort by ${c.label}`}
                        onClick={() => { if (sortKey === c.key) setParam('dir', dir === 1 ? 'desc' : ''); else setParams(p => { const n = new URLSearchParams(p); n.set('sort', c.key); n.delete('dir'); return n }, { replace: true }) }}>
                        {c.label}<span aria-hidden="true" style={{ opacity: sortKey === c.key ? 1 : 0 }}>{dir === 1 ? '↑' : '↓'}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(d => {
                  const p = placement[d.serial]
                  const zfs = zfsErrors(d)
                  return (
                    <tr key={d.serial} onClick={e => { if (!e.target.closest('input,a,button')) navigate(`/drives/${encodeURIComponent(d.serial)}`) }} style={{ cursor: 'pointer' }}>
                      <td>
                        <input type="checkbox" checked={selected.has(d.serial)} onChange={() => toggleOne(d.serial)} aria-label={`Select ${driveName(d)}`}
                          className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--bw-ink)' }} />
                      </td>
                      <td style={{ maxWidth: 300 }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <DriveDot d={d} />
                          <span className="min-w-0">
                            <Link to={`/drives/${encodeURIComponent(d.serial)}`} className="block font-semibold truncate" style={{ color: 'var(--wt-text)', textDecoration: 'none' }}>{driveName(d)}</Link>
                            {d.is_connected === false && <span className="block text-xs" style={{ color: 'var(--wt-text-muted)' }}>Disconnected</span>}
                          </span>
                        </div>
                      </td>
                      <td className="wt-mono" style={{ fontSize: 12.5, color: 'var(--wt-text-muted)' }}>{d.serial}</td>
                      <td style={{ color: 'var(--wt-text-muted)' }}>{formFactorLabel(d.form_factor) || '—'}</td>
                      <td><SmartPill status={d.smart_status} /></td>
                      <td className="wt-mono" style={zfs ? { color: 'var(--wt-warn-600)', fontWeight: 600 } : { color: 'var(--wt-text-faint)' }}>{zfs || '—'}</td>
                      <td><TempCell t={d.temperature_c} thresholds={thresholds} /></td>
                      <td className="wt-mono">{fmtAge(d.power_on_hours)}</td>
                      <td className="wt-mono">{fmtCap(d.capacity_bytes)}</td>
                      <td className="wt-mono" style={{ fontSize: 12.5 }}>{d.zfs_pool || <span style={{ color: 'var(--wt-text-faint)' }}>—</span>}</td>
                      <td style={{ color: 'var(--wt-text-muted)', maxWidth: 220 }} className="truncate">
                        {p ? <>{p.location.name} · <span className="wt-mono">{p.bay.label || `${p.bay.row + 1}-${p.bay.col + 1}`}</span>{isSpare(d, p.bay) ? ' (spare)' : ''}</> : 'Not in a bay'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!rows.length && <div className="py-10 text-center bw-sub">No drives match these filters.</div>}
          <div className="flex justify-between px-6 py-3.5 text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>
            <span>Showing <span className="wt-mono">{rows.length}</span> of <span className="wt-mono">{drives.length}</span> drives</span>
            <span>Sorted by {sortLabel}</span>
          </div>
        </div>
      )}
      {bulkOpen && <BulkEditDialog serials={[...selected]} onClose={() => setBulkOpen(false)} onSaved={async () => { await fleet.refresh(); setSelected(new Set()) }} />}
    </div>
  )
}
