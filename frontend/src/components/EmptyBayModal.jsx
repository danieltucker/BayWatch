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

export default function EmptyBayModal({ bay, onClose, onCreated }) {
  const [form, setForm] = useState({
    serial: '', make: '', model: '', size: '',
    form_factor: '', device_path: '', rpm: '',
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-gray-950 border border-gray-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
              <HardDrive size={16} className="text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Add Drive Manually</p>
              {bay && (
                <p className="text-xs text-gray-500">
                  Bay {bay.label || `${bay.row + 1}-${bay.col + 1}`}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
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
              <label className="text-xs text-gray-400">Form Factor</label>
              <select value={form.form_factor} onChange={e => set('form_factor', e.target.value)}
                className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Device Path" value={form.device_path} onChange={v => set('device_path', v)}
              placeholder="/dev/sda" mono />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Type</label>
              <select value={form.rpm} onChange={e => set('rpm', e.target.value)}
                className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Unknown</option>
                <option value="0">SSD</option>
                <option value="5400">HDD 5400 rpm</option>
                <option value="7200">HDD 7200 rpm</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-700/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : bay ? 'Add & Assign to Bay' : 'Add Drive'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, mono }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 ${mono ? 'font-mono' : ''}`} />
    </div>
  )
}
