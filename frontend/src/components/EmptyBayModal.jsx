import { useState } from 'react'
import { HardDrive, X } from 'lucide-react'
import { createDrive, assignDrive } from '../api/client'

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
        <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                <HardDrive size={16} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Assign Bay</p>
                {bay && (
                  <p className="text-xs text-slate-500 dark:text-gray-500">
                    Bay {bay.label || `${bay.row + 1}-${bay.col + 1}`}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-gray-800 px-5">
            {[
              { key: 'assign', label: 'Assign Existing' },
              { key: 'create', label: 'Create New' },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.key
                    ? 'border-blue-500 text-blue-500 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Assign Existing */}
          {tab === 'assign' && (
            <div className="p-5 flex flex-col gap-3">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by model, make, or serial…"
                autoFocus
                className="w-full rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto -mx-1 px-1">
                {filteredDrives.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-gray-500 py-4 text-center">
                    {drives.length === 0 ? 'No drives found. Run a scan first.' : 'No drives match your search.'}
                  </p>
                )}
                {filteredDrives.map(drive => (
                  <button
                    key={drive.serial}
                    onClick={() => handleAssign(drive.serial)}
                    disabled={assigning}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 w-full"
                  >
                    <HardDrive size={16} className="shrink-0 text-slate-400 dark:text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">
                        {drive.model || drive.serial}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-gray-500 font-mono truncate">{drive.serial}</p>
                    </div>
                    {drive.capacity_bytes && (
                      <span className="text-xs text-slate-400 dark:text-gray-500 shrink-0">
                        {drive.capacity_bytes >= 1e12
                          ? `${(drive.capacity_bytes / 1e12).toFixed(1)} TB`
                          : `${(drive.capacity_bytes / 1e9).toFixed(0)} GB`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {assignError && (
                <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/30 rounded px-3 py-2">
                  {assignError}
                </p>
              )}
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
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 dark:text-gray-400">Form Factor</label>
                  <select value={form.form_factor} onChange={e => set('form_factor', e.target.value)}
                    className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Device Path" value={form.device_path} onChange={v => set('device_path', v)}
                  placeholder="/dev/sda" mono />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 dark:text-gray-400">Type</label>
                  <select value={form.rpm} onChange={e => set('rpm', e.target.value)}
                    className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">Unknown</option>
                    <option value="0">SSD</option>
                    <option value="5400">HDD 5400 rpm</option>
                    <option value="7200">HDD 7200 rpm</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/30 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 rounded-md text-sm text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
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
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 dark:text-gray-400">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 ${mono ? 'font-mono' : ''}`} />
    </div>
  )
}
