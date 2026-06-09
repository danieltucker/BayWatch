import { useState } from 'react'
import { X, HardDrive, AlertTriangle, Zap, Archive } from 'lucide-react'
import {
  setBayStatus, setBayLabel, patchDrive, upsertProfile,
  assignDrive, unassignDrive, createDrive,
} from '../api/client'

const BAY_STATUSES = [
  { value: 'normal',     label: 'Normal',     desc: 'Fully operational',          icon: null },
  { value: 'damaged',    label: 'Damaged',    desc: 'Bay is damaged or unusable', icon: AlertTriangle },
  { value: 'hot_spare',  label: 'Hot Spare',  desc: 'Ready for instant failover', icon: Zap },
  { value: 'cold_spare', label: 'Cold Spare', desc: 'Stored for manual swap',     icon: Archive },
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
  return Math.round(val * ({ TB: 1e12, GB: 1e9, MB: 1e6 }[unit] ?? 1e9))
}

function Field({ label, type = 'text', value, onChange, placeholder, mono, step }) {
  return (
    <div className="wt-field">
      <label className="wt-label">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`wt-input${mono ? ' wt-mono' : ''}`}
      />
    </div>
  )
}

export default function BayModal({ bay, drive, profile, drives = [], arrayName, onClose, onSaved, drivePanel }) {
  const posLabel = bay ? (bay.label || `Row ${bay.row + 1}, Slot ${bay.col + 1}`) : null

  const [bayStatus,  setBayStatusLocal] = useState(bay?.status || 'normal')
  const [bayLabel,   setBayLabelLocal]  = useState(bay?.label  || '')

  const [driveForm, setDriveForm] = useState({
    make:        drive?.make        || '',
    model:       drive?.model       || '',
    form_factor: drive?.form_factor || '',
    rpm:         drive?.rpm != null ? String(drive.rpm) : '',
  })
  const [profileForm, setProfileForm] = useState({
    purchase_date:  profile?.purchase_date  || '',
    warranty_years: profile?.warranty_months != null ? String(profile.warranty_months / 12) : '',
    notes:          profile?.notes          || '',
  })

  const [driveTab,    setDriveTab]    = useState('assign')
  const [search,      setSearch]      = useState('')
  const [assigning,   setAssigning]   = useState(false)
  const [assignError, setAssignError] = useState(null)

  const [createForm, setCreateForm] = useState({
    serial: '', make: '', model: '', size: '', form_factor: '', device_path: '', rpm: '',
  })
  const [creating,    setCreating]    = useState(false)
  const [createError, setCreateError] = useState(null)

  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing,      setRemoving]      = useState(false)

  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState(null)

  const setDf = (k, v) => setDriveForm(p => ({ ...p, [k]: v }))
  const setPf = (k, v) => setProfileForm(p => ({ ...p, [k]: v }))
  const setCf = (k, v) => setCreateForm(p => ({ ...p, [k]: v }))

  const filteredDrives = drives.filter(d => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return d.serial?.toLowerCase().includes(q) || d.model?.toLowerCase().includes(q) || d.make?.toLowerCase().includes(q)
  })

  async function handleAssign(serial) {
    if (!bay) return
    setAssigning(true); setAssignError(null)
    try {
      await assignDrive(bay.id, serial)
      onSaved?.()
    } catch (err) {
      setAssignError(err.response?.data?.detail || 'Failed to assign drive')
      setAssigning(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!createForm.serial.trim()) { setCreateError('Serial number is required'); return }
    setCreating(true); setCreateError(null)
    try {
      const payload = {
        serial:         createForm.serial.trim(),
        make:           createForm.make.trim()        || undefined,
        model:          createForm.model.trim()       || undefined,
        capacity_bytes: parseCapacity(createForm.size) || undefined,
        form_factor:    createForm.form_factor        || undefined,
        device_path:    createForm.device_path.trim() || undefined,
        rpm:            createForm.rpm !== '' ? parseInt(createForm.rpm) : undefined,
      }
      await createDrive(payload)
      if (bay) await assignDrive(bay.id, createForm.serial.trim())
      onSaved?.()
      onClose()
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Failed to create drive')
      setCreating(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      if (bay) await unassignDrive(bay.id)
      onSaved?.()
      onClose()
    } catch (err) {
      setSaveErr(err.response?.data?.detail || 'Failed to remove drive')
      setRemoving(false)
    }
  }

  async function handleSave() {
    setSaving(true); setSaveErr(null)
    try {
      const promises = []
      if (bay) {
        promises.push(setBayStatus(bay.id, bayStatus))
        const newLabel = bayLabel.trim()
        if (newLabel !== (bay.label || '')) promises.push(setBayLabel(bay.id, newLabel))
      }
      if (drive) {
        const patch = {}
        if (driveForm.make.trim() !== (drive.make || ''))        patch.make        = driveForm.make.trim() || null
        if (driveForm.model.trim() !== (drive.model || ''))      patch.model       = driveForm.model.trim() || null
        if (driveForm.form_factor !== (drive.form_factor || '')) patch.form_factor = driveForm.form_factor || null
        const rpmVal = driveForm.rpm !== '' ? parseInt(driveForm.rpm) : null
        if (rpmVal !== drive.rpm) patch.rpm = rpmVal
        if (Object.keys(patch).length) promises.push(patchDrive(drive.serial, patch))
        promises.push(upsertProfile(drive.serial, {
          purchase_date:   profileForm.purchase_date || null,
          warranty_months: profileForm.warranty_years !== '' ? Math.round(parseFloat(profileForm.warranty_years) * 12) : null,
          notes:           profileForm.notes.trim() || null,
        }))
      }
      await Promise.all(promises)
      onSaved?.()
      onClose()
    } catch (err) {
      setSaveErr(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBayOnly() {
    setSaving(true); setSaveErr(null)
    try {
      if (bay) {
        await setBayStatus(bay.id, bayStatus)
        const newLabel = bayLabel.trim()
        if (newLabel !== (bay.label || '')) await setBayLabel(bay.id, newLabel)
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setSaveErr(err.response?.data?.detail || 'Failed to save bay')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className={`relative w-full ${drivePanel ? 'max-w-5xl' : 'max-w-md'} rounded-2xl border shadow-2xl overflow-hidden`}
          style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--wt-border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--wt-surface-2)' }}>
                <HardDrive size={16} style={{ color: 'var(--wt-brand-500)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>
                  {drive ? 'Edit Bay & Drive' : bay ? 'Configure Bay' : 'Edit Drive'}
                </p>
                {posLabel && (
                  <p className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>
                    {posLabel}{arrayName ? ` · ${arrayName}` : ''}
                  </p>
                )}
                {!bay && drive && (
                  <p className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>{drive.serial}</p>
                )}
              </div>
            </div>
            <button onClick={onClose}
              className="transition-colors p-1 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={18} />
            </button>
          </div>

          <div className={drivePanel ? 'flex flex-col md:flex-row' : undefined}>
            <div className={`p-5 flex flex-col gap-5 overflow-y-auto ${drivePanel ? 'max-h-[45vh] md:max-h-[calc(90vh-130px)] md:w-[420px] shrink-0' : 'max-h-[calc(90vh-130px)]'}`}
              style={drivePanel ? { borderBottom: '1px solid var(--wt-border)' } : undefined}>

              {/* Bay config section */}
              {bay && (
                <section>
                  <p className="wt-eyebrow mb-3">Bay</p>
                  <div className="flex flex-col gap-3">
                    <Field label="Label" value={bayLabel} onChange={setBayLabelLocal} placeholder={posLabel} />
                    <div className="wt-field">
                      <label className="wt-label">Status</label>
                      <div className="flex flex-col gap-1.5 mt-0.5">
                        {BAY_STATUSES.map(s => {
                          const Icon = s.icon
                          const active = bayStatus === s.value
                          const activeStyle = bayStatusActiveStyle(s.value)
                          return (
                            <button
                              key={s.value}
                              type="button"
                              onClick={() => setBayStatusLocal(s.value)}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 border text-left transition-all text-sm"
                              style={active
                                ? activeStyle
                                : { borderColor: 'var(--wt-border)', color: 'var(--wt-text-muted)', background: 'var(--wt-surface)' }
                              }
                            >
                              <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                style={{ background: active ? 'color-mix(in oklch, currentColor 12%, transparent)' : 'var(--wt-surface-2)' }}>
                                {Icon
                                  ? <Icon size={12} style={{ color: active ? activeStyle.color : 'var(--wt-text-faint)' }} />
                                  : <span className="w-1.5 h-1.5 rounded-full"
                                      style={{ background: active ? activeStyle.color : 'var(--wt-n-300)' }} />
                                }
                              </span>
                              <span className="flex-1 flex items-center gap-2">
                                <span className="font-medium" style={active ? { color: activeStyle.color } : undefined}>
                                  {s.label}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--wt-text-faint)' }}>{s.desc}</span>
                              </span>
                              {active && (
                                <span className="wt-eyebrow px-1.5 py-0.5 rounded"
                                  style={{ color: activeStyle.color, border: '1px solid currentColor', background: 'color-mix(in oklch, currentColor 10%, transparent)' }}>
                                  Active
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Drive section */}
              <section>
                <p className="wt-eyebrow mb-3">Drive</p>

                {!drive ? (
                  <div>
                    {/* Sub-tabs */}
                    <div className="flex mb-4" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                      {[{ key: 'assign', label: 'Assign Existing' }, { key: 'create', label: 'Create New' }].map(t => (
                        <button key={t.key} onClick={() => setDriveTab(t.key)}
                          className="px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
                          style={driveTab === t.key
                            ? { borderColor: 'var(--wt-brand-500)', color: 'var(--wt-brand-500)' }
                            : { borderColor: 'transparent', color: 'var(--wt-text-muted)' }
                          }>
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {driveTab === 'assign' && (
                      <div className="flex flex-col gap-3">
                        <input value={search} onChange={e => setSearch(e.target.value)}
                          placeholder="Search by model, make, or serial…"
                          autoFocus className="wt-input w-full" />
                        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto -mx-1 px-1">
                          {filteredDrives.length === 0 && (
                            <p className="text-sm py-4 text-center" style={{ color: 'var(--wt-text-muted)' }}>
                              {drives.length === 0 ? 'No drives found. Run a scan first.' : 'No drives match your search.'}
                            </p>
                          )}
                          {filteredDrives.map(d => (
                            <button key={d.serial} onClick={() => handleAssign(d.serial)}
                              disabled={assigning}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--wt-surface-2)] transition-colors disabled:opacity-50 w-full">
                              <HardDrive size={15} className="shrink-0" style={{ color: 'var(--wt-text-faint)' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--wt-text)' }}>{d.make || d.serial}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--wt-text-muted)' }}>{d.model || d.serial}</p>
                              </div>
                              {d.capacity_bytes && (
                                <span className="wt-mono text-xs shrink-0" style={{ color: 'var(--wt-text-faint)' }}>
                                  {d.capacity_bytes >= 1e12
                                    ? `${(d.capacity_bytes / 1e12).toFixed(1)} TB`
                                    : `${(d.capacity_bytes / 1e9).toFixed(0)} GB`}
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

                    {driveTab === 'create' && (
                      <form onSubmit={handleCreate} className="flex flex-col gap-3">
                        <Field label="Serial Number *" value={createForm.serial} onChange={v => setCf('serial', v)}
                          placeholder="e.g. WD-WMAYP1234567" mono />
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Make" value={createForm.make} onChange={v => setCf('make', v)} placeholder="e.g. Seagate" />
                          <Field label="Model" value={createForm.model} onChange={v => setCf('model', v)} placeholder="e.g. ST8000DM004" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Size" value={createForm.size} onChange={v => setCf('size', v)} placeholder="e.g. 8 TB" />
                          <div className="wt-field">
                            <label className="wt-label">Form Factor</label>
                            <select value={createForm.form_factor} onChange={e => setCf('form_factor', e.target.value)}
                              className="wt-select">
                              {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Device Path" value={createForm.device_path} onChange={v => setCf('device_path', v)}
                            placeholder="/dev/sda" mono />
                          <div className="wt-field">
                            <label className="wt-label">Type</label>
                            <select value={createForm.rpm} onChange={e => setCf('rpm', e.target.value)}
                              className="wt-select">
                              <option value="">Unknown</option>
                              <option value="0">SSD</option>
                              <option value="5400">HDD 5400 rpm</option>
                              <option value="7200">HDD 7200 rpm</option>
                            </select>
                          </div>
                        </div>
                        {createError && (
                          <p className="text-xs rounded px-3 py-2 border"
                            style={{ color: 'var(--wt-down-600)', background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
                            {createError}
                          </p>
                        )}
                        <div className="flex justify-end gap-2 pt-1">
                          <button type="submit" disabled={creating}
                            className="wt-btn wt-btn--primary disabled:opacity-50">
                            {creating ? 'Saving…' : 'Add & Assign to Bay'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="wt-eyebrow mb-3">Drive Info</p>
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Make" value={driveForm.make} onChange={v => setDf('make', v)} placeholder="e.g. Seagate" />
                          <Field label="Model" value={driveForm.model} onChange={v => setDf('model', v)} placeholder="e.g. ST8000DM004" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="wt-field">
                            <label className="wt-label">Form Factor</label>
                            <select value={driveForm.form_factor} onChange={e => setDf('form_factor', e.target.value)}
                              className="wt-select">
                              {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                            </select>
                          </div>
                          <div className="wt-field">
                            <label className="wt-label">Type</label>
                            <select value={driveForm.rpm} onChange={e => setDf('rpm', e.target.value)}
                              className="wt-select">
                              <option value="">Unknown</option>
                              <option value="0">SSD</option>
                              <option value="5400">HDD 5400 rpm</option>
                              <option value="7200">HDD 7200 rpm</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="wt-eyebrow mb-3">Ownership</p>
                      <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Purchase Date" type="date" value={profileForm.purchase_date} onChange={v => setPf('purchase_date', v)} />
                          <Field label="Warranty (years)" type="number" step="0.5" value={profileForm.warranty_years} onChange={v => setPf('warranty_years', v)} placeholder="e.g. 3" />
                        </div>
                        <div className="wt-field">
                          <label className="wt-label">Notes</label>
                          <textarea value={profileForm.notes} onChange={e => setPf('notes', e.target.value)}
                            rows={3} placeholder="Any notes about this drive…"
                            className="wt-textarea resize-none" />
                        </div>
                      </div>
                    </div>

                    {bay && (
                      <div className="pt-1" style={{ borderTop: '1px solid var(--wt-border)' }}>
                        {!confirmRemove ? (
                          <button type="button" onClick={() => setConfirmRemove(true)}
                            className="mt-3 text-xs transition-colors"
                            style={{ color: 'var(--wt-down-500)' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-down-600)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-down-500)'}>
                            Remove drive from bay…
                          </button>
                        ) : (
                          <div className="mt-3 rounded-lg px-3 py-2.5 border flex items-start justify-between gap-3"
                            style={{ background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--wt-down-600)' }}>
                              Remove <span className="wt-mono font-semibold">{drive.serial}</span> from this bay?{' '}
                              <span style={{ color: 'var(--wt-down-500)' }}>Drive data will be kept.</span>
                            </p>
                            <div className="flex gap-3 shrink-0 mt-0.5">
                              <button onClick={() => setConfirmRemove(false)}
                                className="text-xs transition-colors"
                                style={{ color: 'var(--wt-text-muted)' }}>
                                Cancel
                              </button>
                              <button onClick={handleRemove} disabled={removing}
                                className="text-xs font-semibold transition-colors disabled:opacity-50"
                                style={{ color: 'var(--wt-down-500)' }}>
                                {removing ? 'Removing…' : 'Remove'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {saveErr && (
                <p className="text-xs rounded px-3 py-2 border"
                  style={{ color: 'var(--wt-down-600)', background: 'var(--wt-down-50)', borderColor: 'var(--wt-down-100)' }}>
                  {saveErr}
                </p>
              )}
            </div>

            {drivePanel && (
              <div className="flex-1 overflow-y-auto max-h-[45vh] md:max-h-[calc(90vh-130px)] p-3"
                style={{ background: 'var(--wt-bg)', borderLeft: '1px solid var(--wt-border)' }}>
                {drivePanel}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4"
            style={{ borderTop: '1px solid var(--wt-border)' }}>
            <button onClick={onClose} className="wt-btn wt-btn--ghost">Cancel</button>
            {drive ? (
              <button onClick={handleSave} disabled={saving}
                className="wt-btn wt-btn--primary disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            ) : bay ? (
              <button onClick={handleSaveBayOnly} disabled={saving}
                className="wt-btn wt-btn--primary disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Bay'}
              </button>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  )
}
