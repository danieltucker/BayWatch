import { useState } from 'react'
import { Pencil, X, Save } from 'lucide-react'
import { patchDrive, upsertProfile } from '../api/client'

const FORM_FACTORS = ['', '3.5"', '2.5"', 'M.2', 'U.2', 'other']

const DRIVE_TYPES = [
  { value: '', label: '— Auto-detect —' },
  { value: 'consumer_hdd', label: 'Consumer HDD' },
  { value: 'nas_hdd',      label: 'NAS / Desktop HDD' },
  { value: 'enterprise_hdd', label: 'Enterprise HDD' },
  { value: 'consumer_ssd', label: 'Consumer SSD' },
  { value: 'enterprise_ssd', label: 'Enterprise SSD' },
  { value: 'nvme_consumer', label: 'NVMe (Consumer)' },
  { value: 'nvme_enterprise', label: 'NVMe (Enterprise)' },
  { value: 'optane',        label: 'Intel Optane' },
]

const SSD_TYPES = new Set(['consumer_ssd', 'enterprise_ssd', 'nvme_consumer', 'nvme_enterprise', 'optane'])

export default function DriveEditModal({ drive, profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    make: drive.make || '',
    model: drive.model || '',
    form_factor: drive.form_factor || '',
    rpm: drive.rpm != null ? String(drive.rpm) : '',
    drive_type: drive.drive_type || '',
    rated_tbw: profile?.rated_tbw != null ? String(profile.rated_tbw) : '',
    purchase_date: profile?.purchase_date || '',
    warranty_years: profile?.warranty_months != null ? String(profile.warranty_months / 12) : '',
    notes: profile?.notes || '',
  })

  const isSSD = SSD_TYPES.has(form.drive_type)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const drivePatch = {}
      if (form.make.trim() !== (drive.make || '')) drivePatch.make = form.make.trim() || null
      if (form.model.trim() !== (drive.model || '')) drivePatch.model = form.model.trim() || null
      if (form.form_factor !== (drive.form_factor || '')) drivePatch.form_factor = form.form_factor || null
      const rpmVal = form.rpm !== '' ? parseInt(form.rpm) : null
      if (rpmVal !== drive.rpm) drivePatch.rpm = rpmVal
      if (form.drive_type !== (drive.drive_type || '')) drivePatch.drive_type = form.drive_type || null

      const tbwVal = isSSD && form.rated_tbw !== '' ? parseInt(form.rated_tbw) : null
      const profilePayload = {
        purchase_date: form.purchase_date || null,
        warranty_months: form.warranty_years !== '' ? Math.round(parseFloat(form.warranty_years) * 12) : null,
        rated_tbw: tbwVal,
        notes: form.notes.trim() || null,
      }

      await Promise.all([
        Object.keys(drivePatch).length ? patchDrive(drive.serial, drivePatch) : Promise.resolve(),
        upsertProfile(drive.serial, profilePayload),
      ])
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
        <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                <Pencil size={14} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Edit Drive</p>
                <p className="text-xs text-slate-500 dark:text-gray-500 font-mono">{drive.serial}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-3">Drive Info</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Make" value={form.make} onChange={v => set('make', v)} placeholder="e.g. Seagate" />
                  <Field label="Model" value={form.model} onChange={v => set('model', v)} placeholder="e.g. ST8000DM004" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-gray-400">Form Factor</label>
                    <select value={form.form_factor} onChange={e => set('form_factor', e.target.value)}
                      className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-gray-400">RPM</label>
                    <select value={form.rpm} onChange={e => set('rpm', e.target.value)}
                      className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="">Unknown</option>
                      <option value="0">SSD / NVMe</option>
                      <option value="5400">5400 rpm</option>
                      <option value="7200">7200 rpm</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 dark:text-gray-400">Drive Classification</label>
                  <select value={form.drive_type} onChange={e => set('drive_type', e.target.value)}
                    className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {DRIVE_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-400 dark:text-gray-600 leading-snug">
                    Controls age curve and heat thresholds used in the health score. Leave on auto-detect to infer from RPM and model.
                  </p>
                </div>
                {isSSD && (
                  <Field
                    label="Rated TBW (TB)"
                    type="number"
                    value={form.rated_tbw}
                    onChange={v => set('rated_tbw', v)}
                    placeholder="e.g. 600"
                  />
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-3">Ownership</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Purchase Date" type="date" value={form.purchase_date} onChange={v => set('purchase_date', v)} />
                  <Field label="Warranty (years)" type="number" step="0.5" value={form.warranty_years} onChange={v => set('warranty_years', v)} placeholder="e.g. 3" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500 dark:text-gray-400">Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                    placeholder="Any notes about this drive…"
                    className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/30 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-md text-sm text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, step }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 dark:text-gray-400">{label}</label>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>
  )
}
