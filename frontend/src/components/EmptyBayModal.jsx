import { useState } from 'react'
import { HardDrive, X, AlertTriangle, Zap, Archive } from 'lucide-react'
import { createDrive, assignDrive, unassignDrive, setBayStatus } from '../api/client'

const BAY_STATUSES = [
  { value: 'normal',     label: 'Normal',     desc: 'Fully operational bay',          icon: null },
  { value: 'damaged',    label: 'Damaged',    desc: 'Bay is damaged or unusable',     icon: AlertTriangle },
  { value: 'hot_spare',  label: 'Hot Spare',  desc: 'Drive ready for instant failover', icon: Zap },
  { value: 'cold_spare', label: 'Cold Spare', desc: 'Drive stored for manual swap',    icon: Archive },
]

function bayStatusActiveStyle(value) {
  switch (value) {
    case 'damaged':    return { color: 'var(--wt-warn-600)',    borderColor: 'var(--wt-warn-200)',  background: 'var(--wt-warn-50)' }
    case 'hot_spare':  return { color: 'var(--bw-ink)',          borderColor: 'color-mix(in oklch, var(--bw-ink) 25%, transparent)', background: 'color-mix(in oklch, var(--bw-ink) 8%, transparent)' }
    case 'cold_spare': return { color: 'var(--wt-text-muted)',  borderColor: 'var(--wt-border)',    background: 'var(--wt-surface-2)' }
    default:           return { color: 'var(--wt-text-subtle)', borderColor: 'var(--wt-border)',    background: 'var(--wt-surface-2)' }
  }
}

const FORM_FACTORS = ['', '3.5"', '2.5"', 'M.2', 'U.2', 'other']

function parseCapacity(str) {
  if (!str) return null
  const m = str.trim().match(/^([\d.]+)\s*(TB|GB|MB)?$/i)
  if (!m) return null
  const val = parseFloat(m[1])
  const unit = (m[2] || 'GB').toUpperCase()
  const mult = { TB: 1e12, GB: 1e9, MB: 1e6 }
  return Math.round(val * (mult[unit] ?? 1e9))
}

export default function EmptyBayModal({ bay, drives = [], onClose, onCreated }) {
  const [tab, setTab] = useState('create')
  const [form, setForm] = useState({
    serial: '', make: '', model: '', size: '',
    form_factor: '', device_path: '', rpm: '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState(null)
  const [unassigning, setUnassigning] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(bay?.status ?? 'normal')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusSaved, setStatusSaved] = useState(false)

  async function handleSetStatus(value) {
    setSelectedStatus(value)
    if (!bay) return
    setStatusSaving(true); setStatusSaved(false)
    try {
      await setBayStatus(bay.id, value)
      onCreated?.()
      setStatusSaved(true)
      setTimeout(() => setStatusSaved(false), 2000)
    } catch {} finally {
      setStatusSaving(false)
    }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.serial.trim()) { setError('Serial number is required'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        serial: form.serial.trim(),
        make: form.make.trim() || undefined,
        model: form.model.trim() || undefined,
        capacity_bytes: parseCapacity(form.size) || undefined,
        form_factor: form.form_factor || undefined,
        device_path: form.device_path.trim() || undefined,
        rpm: form.rpm !== '' ? parseInt(form.rpm) : undefined,
      }
      await createDrive(payload)
      if (bay) await assignDrive(bay.id, form.serial.trim())
      onCreated?.()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create drive')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssign(serial) {
    setAssigning(true); setAssignError(null)
    try {
      await assignDrive(bay.id, serial)
      onCreated?.()
    } catch (err) {
      setAssignError(err.response?.data?.detail || 'Failed to assign drive')
      setAssigning(false)
    }
  }

  async function handleUnassign() {
    setUnassigning(true); setAssignError(null)
    try {
      await unassignDrive(bay.id)
      onCreated?.()
    } catch (err) {
      setAssignError(err.response?.data?.detail || 'Failed to unassign drive')
      setUnassigning(false)
    }
  }

  const filteredDrives = drives.filter(d => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      d.serial?.toLowerCase().includes(q) ||
      d.model?.toLowerCase().includes(q) ||
      d.make?.toLowerCase().includes(q)
    )
  })

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
                <HardDrive size={16} style={{ color: 'var(--wt-brand-500)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>Assign Bay</p>
                {bay && (
                  <p className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>
                    Bay {bay.label || `${bay.row + 1}-${bay.col + 1}`}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="transition-colors p-1 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-5" style={{ borderBottom: '1px solid var(--wt-border)' }}>
            {[
              { key: 'assign', label: 'Assign Existing' },
              { key: 'create', label: 'Create New' },
              { key: 'status', label: 'Bay Status' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px"
                style={tab === t.key
                  ? { borderColor: 'var(--wt-brand-500)', color: 'var(--wt-brand-500)' }
                  : { borderColor: 'transparent', color: 'var(--wt-text-muted)' }
                }>
                {t.label}
              </button>
            ))}
          </div>

          {/* Assign Existing */}
          {tab === 'assign' && (
            <div className="p-5 flex flex-col gap-3">
              {bay?.drive_serial && (
                <button
                  onClick={handleUnassign}
                  disabled={unassigning}
                  className="flex items-center gap-2 w-full rounded-lg px-3 py-2.5 border text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--wt-down-100)', background: 'var(--wt-down-50)', color: 'var(--wt-down-600)' }}
                >
                  <HardDrive size={14} className="shrink-0" />
                  {unassigning ? 'Removing…' : 'Remove drive from this bay'}
                </button>
              )}
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by model, make, or serial…"
                autoFocus
                className="wt-input w-full"
              />
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto -mx-1 px-1">
                {filteredDrives.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: 'var(--wt-text-muted)' }}>
                    {drives.length === 0 ? 'No drives found. Run a scan first.' : 'No drives match your search.'}
                  </p>
                )}
                {filteredDrives.map(drive => (
                  <button
                    key={drive.serial}
                    onClick={() => handleAssign(drive.serial)}
                    disabled={assigning}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--wt-surface-2)] transition-colors disabled:opacity-50 w-full"
                  >
                    <HardDrive size={16} className="shrink-0" style={{ color: 'var(--wt-text-faint)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--wt-text)' }}>
                        {drive.make || drive.serial}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--wt-text-muted)' }}>{drive.model || drive.serial}</p>
                    </div>
                    {drive.capacity_bytes && (
                      <span className="wt-mono text-xs shrink-0" style={{ color: 'var(--wt-text-faint)' }}>
                        {drive.capacity_bytes >= 1e12
                          ? `${(drive.capacity_bytes / 1e12).toFixed(1)} TB`
                          : `${(drive.capacity_bytes / 1e9).toFixed(0)} GB`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {assignError && (
                <p className="text-xs rounded px-3 py-2 border"
                  style={{ color: 'var(--wt-down-600)', background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
                  {assignError}
                </p>
              )}
            </div>
          )}

          {/* Bay Status */}
          {tab === 'status' && (
            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>
                Set the operational status of this bay slot.
              </p>
              <div className="flex flex-col gap-2">
                {BAY_STATUSES.map(s => {
                  const Icon = s.icon
                  const isActive = selectedStatus === s.value
                  const activeStyle = bayStatusActiveStyle(s.value)
                  return (
                    <button
                      key={s.value}
                      onClick={() => handleSetStatus(s.value)}
                      disabled={statusSaving}
                      className="flex items-center gap-3 rounded-lg px-4 py-3 border text-left transition-all disabled:opacity-50"
                      style={isActive
                        ? activeStyle
                        : { borderColor: 'var(--wt-border)', color: 'var(--wt-text-muted)', background: 'var(--wt-surface)' }
                      }
                    >
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: isActive ? 'color-mix(in oklch, currentColor 12%, transparent)' : 'var(--wt-surface-2)' }}>
                        {Icon
                          ? <Icon size={14} style={isActive ? { color: activeStyle.color } : { color: 'var(--wt-text-faint)' }} />
                          : <span className="w-2 h-2 rounded-full"
                              style={{ background: isActive ? activeStyle.color : 'var(--wt-n-300)' }} />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={isActive ? { color: activeStyle.color } : undefined}>{s.label}</p>
                        <p className="text-xs" style={{ color: 'var(--wt-text-faint)' }}>{s.desc}</p>
                      </div>
                      {isActive && (
                        <span className="wt-eyebrow px-1.5 py-0.5 rounded"
                          style={{ color: activeStyle.color, border: '1px solid currentColor', background: 'color-mix(in oklch, currentColor 10%, transparent)' }}>
                          {statusSaved ? 'Saved' : 'Active'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Create New */}
          {tab === 'create' && (
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
              <Field label="Serial Number *" value={form.serial} onChange={v => set('serial', v)}
                placeholder="e.g. WD-WMAYP1234567" mono />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Make" value={form.make} onChange={v => set('make', v)} placeholder="e.g. Seagate" />
                <Field label="Model" value={form.model} onChange={v => set('model', v)} placeholder="e.g. ST8000DM004" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Size" value={form.size} onChange={v => set('size', v)} placeholder="e.g. 8 TB" />
                <div className="wt-field">
                  <label className="wt-label">Form Factor</label>
                  <select value={form.form_factor} onChange={e => set('form_factor', e.target.value)}
                    className="wt-select">
                    {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Device Path" value={form.device_path} onChange={v => set('device_path', v)}
                  placeholder="/dev/sda" mono />
                <div className="wt-field">
                  <label className="wt-label">Type</label>
                  <select value={form.rpm} onChange={e => set('rpm', e.target.value)}
                    className="wt-select">
                    <option value="">Unknown</option>
                    <option value="0">SSD</option>
                    <option value="5400">HDD 5400 rpm</option>
                    <option value="7200">HDD 7200 rpm</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-xs rounded px-3 py-2 border"
                  style={{ color: 'var(--wt-down-600)', background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="wt-btn wt-btn--ghost">Cancel</button>
                <button type="submit" disabled={saving}
                  className="wt-btn wt-btn--primary disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add & Assign to Bay'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, mono }) {
  return (
    <div className="wt-field">
      <label className="wt-label">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`wt-input${mono ? ' wt-mono' : ''}`} />
    </div>
  )
}
