import { useState } from 'react'
import { X, HardDrive, AlertTriangle, Zap, Archive } from 'lucide-react'
import {
  setBayStatus, setBayLabel, patchDrive, upsertProfile,
  assignDrive, unassignDrive, createDrive,
} from '../api/client'

const BAY_STATUSES = [
  { value: 'normal',     label: 'Normal',     desc: 'Fully operational',        icon: null,          color: 'text-slate-500 dark:text-gray-400' },
  { value: 'damaged',    label: 'Damaged',    desc: 'Bay is damaged or unusable', icon: AlertTriangle, color: 'text-red-500 dark:text-red-400' },
  { value: 'hot_spare',  label: 'Hot Spare',  desc: 'Ready for instant failover', icon: Zap,           color: 'text-amber-500 dark:text-amber-400' },
  { value: 'cold_spare', label: 'Cold Spare', desc: 'Stored for manual swap',     icon: Archive,       color: 'text-sky-500 dark:text-sky-400' },
]

const FORM_FACTORS = ['', '3.5"', '2.5"', 'M.2', 'U.2', 'other']

function parseCapacity(str) {
  if (!str) return null
  const m = str.trim().match(/^([\d.]+)\s*(TB|GB|MB)?$/i)
  if (!m) return null
  const val = parseFloat(m[1])
  const unit = (m[2] || 'GB').toUpperCase()
  return Math.round(val * ({ TB: 1e12, GB: 1e9, MB: 1e6 }[unit] ?? 1e9))
}

const INPUT = 'w-full rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500'
const LABEL = 'text-xs text-slate-500 dark:text-gray-400'

function Field({ label, type = 'text', value, onChange, placeholder, mono, step }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT}${mono ? ' font-mono' : ''}`}
      />
    </div>
  )
}

export default function BayModal({ bay, drive, profile, drives = [], arrayName, onClose, onSaved, drivePanel }) {
  const posLabel = bay ? (bay.label || `Row ${bay.row + 1}, Slot ${bay.col + 1}`) : null

  // Bay config state
  const [bayStatus,  setBayStatusLocal] = useState(bay?.status || 'normal')
  const [bayLabel,   setBayLabelLocal]  = useState(bay?.label  || '')

  // Drive edit state (when drive present)
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

  // Assign existing state
  const [driveTab,    setDriveTab]    = useState('assign')
  const [search,      setSearch]      = useState('')
  const [assigning,   setAssigning]   = useState(false)
  const [assignError, setAssignError] = useState(null)

  // Create new state
  const [createForm, setCreateForm] = useState({
    serial: '', make: '', model: '', size: '', form_factor: '', device_path: '', rpm: '',
  })
  const [creating,     setCreating]     = useState(false)
  const [createError,  setCreateError]  = useState(null)

  // Remove state
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing,      setRemoving]      = useState(false)

  // Save state
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
        serial:        createForm.serial.trim(),
        make:          createForm.make.trim()        || undefined,
        model:         createForm.model.trim()       || undefined,
        capacity_bytes: parseCapacity(createForm.size) || undefined,
        form_factor:   createForm.form_factor        || undefined,
        device_path:   createForm.device_path.trim() || undefined,
        rpm:           createForm.rpm !== '' ? parseInt(createForm.rpm) : undefined,
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
        if (newLabel !== (bay.label || '')) {
          promises.push(setBayLabel(bay.id, newLabel))
        }
      }

      if (drive) {
        const patch = {}
        if (driveForm.make.trim() !== (drive.make || ''))               patch.make        = driveForm.make.trim() || null
        if (driveForm.model.trim() !== (drive.model || ''))             patch.model       = driveForm.model.trim() || null
        if (driveForm.form_factor !== (drive.form_factor || ''))        patch.form_factor = driveForm.form_factor || null
        const rpmVal = driveForm.rpm !== '' ? parseInt(driveForm.rpm) : null
        if (rpmVal !== drive.rpm)                                        patch.rpm         = rpmVal
        if (Object.keys(patch).length) promises.push(patchDrive(drive.serial, patch))

        promises.push(upsertProfile(drive.serial, {
          purchase_date:    profileForm.purchase_date || null,
          warranty_months:  profileForm.warranty_years !== ''
            ? Math.round(parseFloat(profileForm.warranty_years) * 12)
            : null,
          notes: profileForm.notes.trim() || null,
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
        <div className={`relative w-full ${drivePanel ? 'max-w-5xl' : 'max-w-md'} rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden`}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                <HardDrive size={16} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {drive ? 'Edit Bay & Drive' : bay ? 'Configure Bay' : 'Edit Drive'}
                </p>
                {posLabel && <p className="text-xs text-slate-500 dark:text-gray-500">{posLabel}{arrayName ? ` · ${arrayName}` : ''}</p>}
                {!bay && drive && <p className="text-xs text-slate-500 dark:text-gray-500 font-mono">{drive.serial}</p>}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
              <X size={18} />
            </button>
          </div>

          <div className={drivePanel ? 'flex' : undefined}>
          <div className={`p-5 flex flex-col gap-5 overflow-y-auto max-h-[calc(90vh-130px)] ${drivePanel ? 'w-[420px] shrink-0 border-r border-slate-200 dark:border-gray-800' : ''}`}>

            {/* Bay config section */}
            {bay && (
              <section>
                <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-3">Bay</p>
                <div className="flex flex-col gap-3">
                  <Field
                    label="Label"
                    value={bayLabel}
                    onChange={setBayLabelLocal}
                    placeholder={posLabel}
                  />
                  <div className="flex flex-col gap-2">
                    <label className={LABEL}>Status</label>
                    <div className="flex flex-col gap-1.5">
                      {BAY_STATUSES.map(s => {
                        const Icon = s.icon
                        const active = bayStatus === s.value
                        return (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setBayStatusLocal(s.value)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-left transition-all text-sm ${
                              active
                                ? `border-current ${s.color} bg-slate-50 dark:bg-gray-800/60`
                                : 'border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800/40'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${active ? 'bg-current/10' : 'bg-slate-100 dark:bg-gray-800'}`}>
                              {Icon
                                ? <Icon size={12} className={active ? 'inherit' : 'text-slate-400 dark:text-gray-500'} />
                                : <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-current' : 'bg-slate-300 dark:bg-gray-600'}`} />
                              }
                            </span>
                            <span className="flex-1">
                              <span className={`font-medium ${active ? s.color : ''}`}>{s.label}</span>
                              <span className="text-xs text-slate-400 dark:text-gray-600 ml-2">{s.desc}</span>
                            </span>
                            {active && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border border-current/30 bg-current/10 ${s.color}`}>Active</span>}
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
              <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-3">Drive</p>

              {!drive ? (
                /* No drive assigned */
                <div>
                  {/* Sub-tabs */}
                  <div className="flex border-b border-slate-200 dark:border-gray-800 mb-4 -mx-0">
                    {[{ key: 'assign', label: 'Assign Existing' }, { key: 'create', label: 'Create New' }].map(t => (
                      <button
                        key={t.key}
                        onClick={() => setDriveTab(t.key)}
                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                          driveTab === t.key
                            ? 'border-blue-500 text-blue-500 dark:text-blue-400'
                            : 'border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {driveTab === 'assign' && (
                    <div className="flex flex-col gap-3">
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by model, make, or serial…"
                        autoFocus
                        className={INPUT}
                      />
                      <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto -mx-1 px-1">
                        {filteredDrives.length === 0 && (
                          <p className="text-sm text-slate-500 dark:text-gray-500 py-4 text-center">
                            {drives.length === 0 ? 'No drives found. Run a scan first.' : 'No drives match your search.'}
                          </p>
                        )}
                        {filteredDrives.map(d => (
                          <button
                            key={d.serial}
                            onClick={() => handleAssign(d.serial)}
                            disabled={assigning}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 w-full"
                          >
                            <HardDrive size={15} className="shrink-0 text-slate-400 dark:text-gray-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">{d.make || d.serial}</p>
                              <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{d.model || d.serial}</p>
                            </div>
                            {d.capacity_bytes && (
                              <span className="text-xs text-slate-400 dark:text-gray-500 shrink-0">
                                {d.capacity_bytes >= 1e12
                                  ? `${(d.capacity_bytes / 1e12).toFixed(1)} TB`
                                  : `${(d.capacity_bytes / 1e9).toFixed(0)} GB`}
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

                  {driveTab === 'create' && (
                    <form onSubmit={handleCreate} className="flex flex-col gap-3">
                      <Field label="Serial Number *" value={createForm.serial} onChange={v => setCf('serial', v)} placeholder="e.g. WD-WMAYP1234567" mono />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Make" value={createForm.make} onChange={v => setCf('make', v)} placeholder="e.g. Seagate" />
                        <Field label="Model" value={createForm.model} onChange={v => setCf('model', v)} placeholder="e.g. ST8000DM004" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Size" value={createForm.size} onChange={v => setCf('size', v)} placeholder="e.g. 8 TB" />
                        <div className="flex flex-col gap-1">
                          <label className={LABEL}>Form Factor</label>
                          <select value={createForm.form_factor} onChange={e => setCf('form_factor', e.target.value)} className={INPUT}>
                            {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Device Path" value={createForm.device_path} onChange={v => setCf('device_path', v)} placeholder="/dev/sda" mono />
                        <div className="flex flex-col gap-1">
                          <label className={LABEL}>Type</label>
                          <select value={createForm.rpm} onChange={e => setCf('rpm', e.target.value)} className={INPUT}>
                            <option value="">Unknown</option>
                            <option value="0">SSD</option>
                            <option value="5400">HDD 5400 rpm</option>
                            <option value="7200">HDD 7200 rpm</option>
                          </select>
                        </div>
                      </div>
                      {createError && (
                        <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/30 rounded px-3 py-2">
                          {createError}
                        </p>
                      )}
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="submit" disabled={creating}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">
                          {creating ? 'Saving…' : 'Add & Assign to Bay'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Drive present — edit fields */
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-3">Drive Info</p>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Make" value={driveForm.make} onChange={v => setDf('make', v)} placeholder="e.g. Seagate" />
                        <Field label="Model" value={driveForm.model} onChange={v => setDf('model', v)} placeholder="e.g. ST8000DM004" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className={LABEL}>Form Factor</label>
                          <select value={driveForm.form_factor} onChange={e => setDf('form_factor', e.target.value)} className={INPUT}>
                            {FORM_FACTORS.map(f => <option key={f} value={f}>{f || '—'}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={LABEL}>Type</label>
                          <select value={driveForm.rpm} onChange={e => setDf('rpm', e.target.value)} className={INPUT}>
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
                    <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-3">Ownership</p>
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Purchase Date" type="date" value={profileForm.purchase_date} onChange={v => setPf('purchase_date', v)} />
                        <Field label="Warranty (years)" type="number" step="0.5" value={profileForm.warranty_years} onChange={v => setPf('warranty_years', v)} placeholder="e.g. 3" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={LABEL}>Notes</label>
                        <textarea
                          value={profileForm.notes}
                          onChange={e => setPf('notes', e.target.value)}
                          rows={3}
                          placeholder="Any notes about this drive…"
                          className={`${INPUT} resize-none`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Remove from bay */}
                  {bay && (
                    <div className="pt-1 border-t border-slate-100 dark:border-gray-800">
                      {!confirmRemove ? (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(true)}
                          className="mt-3 text-xs text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          Remove drive from bay…
                        </button>
                      ) : (
                        <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 px-3 py-2.5 flex items-start justify-between gap-3">
                          <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                            Remove <span className="font-mono font-semibold">{drive.serial}</span> from this bay?{' '}
                            <span className="text-red-400 dark:text-red-500">Drive data will be kept.</span>
                          </p>
                          <div className="flex gap-3 shrink-0 mt-0.5">
                            <button onClick={() => setConfirmRemove(false)} className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-700 transition-colors">Cancel</button>
                            <button onClick={handleRemove} disabled={removing} className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 disabled:opacity-50 transition-colors">
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
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-700/30 rounded px-3 py-2">
                {saveErr}
              </p>
            )}
          </div>

          </div>
          {drivePanel && (
            <div className="flex-1 overflow-y-auto max-h-[calc(90vh-130px)] p-3 bg-slate-50/50 dark:bg-gray-900/30">
              {drivePanel}
            </div>
          )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-gray-800">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            {drive ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            ) : bay ? (
              <button
                onClick={handleSaveBayOnly}
                disabled={saving}
                className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Bay'}
              </button>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  )
}
