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
                <p className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>Edit Drive</p>
                <p className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>{drive.serial}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="transition-colors p-1 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
            <div>
              <p className="wt-eyebrow mb-3">Drive Info</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Make" value={form.make} onChange={v => set('make', v)} placeholder="e.g. Seagate" />
                  <Field label="Model" value={form.model} onChange={v => set('model', v)} placeholder="e.g. ST8000DM004" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="wt-field">
                    <label className="wt-label">Form Factor</label>
                    <select value={form.form_factor} onChange={e => set('form_factor', e.target.value)}
                      className="wt-select">
                      {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                    </select>
                  </div>
                  <div className="wt-field">
                    <label className="wt-label">RPM</label>
                    <select value={form.rpm} onChange={e => set('rpm', e.target.value)}
                      className="wt-select">
                      <option value="">Unknown</option>
                      <option value="0">SSD / NVMe</option>
                      <option value="5400">5400 rpm</option>
                      <option value="7200">7200 rpm</option>
                    </select>
                  </div>
                </div>
                <div className="wt-field">
                  <label className="wt-label">Drive Classification</label>
                  <select value={form.drive_type} onChange={e => set('drive_type', e.target.value)}
                    className="wt-select">
                    {DRIVE_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <p className="wt-hint">
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
              <p className="wt-eyebrow mb-3">Ownership</p>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Purchase Date" type="date" value={form.purchase_date} onChange={v => set('purchase_date', v)} />
                  <Field label="Warranty (years)" type="number" step="0.5" value={form.warranty_years} onChange={v => set('warranty_years', v)} placeholder="e.g. 3" />
                </div>
                <div className="wt-field">
                  <label className="wt-label">Notes</label>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                    placeholder="Any notes about this drive…"
                    className="wt-textarea resize-none" />
                </div>
              </div>
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
    <div className="wt-field">
      <label className="wt-label">{label}</label>
      <input type={type} step={step} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="wt-input" />
    </div>
  )
}
