import { useMemo, useState } from 'react'
import { ArrowRightLeft, ChevronDown } from 'lucide-react'
import { assignDrive, setBayLabel, setBayStatus, unassignDrive, upsertProfile } from '../api/client'
import { bayLabel } from '../lib/fleet'
import { driveName } from '../lib/format'
import Dialog from './ui/Dialog'

const STATUS_OPTS = [['operational', 'Operational'], ['damaged', 'Damaged'], ['empty', 'Empty']]
const ROLE_OPTS = [['normal', 'Active'], ['hot_spare', 'Hot spare'], ['cold_spare', 'Cold spare']]

function initialStatus(bay, drive) {
  if (!bay) return 'operational'
  if (bay.status === 'damaged') return 'damaged'
  if (!drive) return 'empty'
  return 'operational'
}

/**
 * Edit bay and drive: bay label, bay status, purchase/warranty/notes, and moving the drive.
 * Bottom sheet on mobile, centred card on desktop. Saves only the fields that changed.
 */
export default function EditBayDriveSheet({ bay, drive, profile, location, array, locations, onClose, onSaved }) {
  const p = profile || {}
  const [form, setForm] = useState({
    label: bay?.label || '',
    status: initialStatus(bay, drive),
    role: ['hot_spare', 'cold_spare'].includes(bay?.status) ? bay.status : 'normal',
    purchase_date: p.purchase_date || '',
    warranty_years: p.warranty_months != null ? String(+(p.warranty_months / 12).toFixed(2)) : '',
    notes: p.notes || '',
    vendor: p.vendor || '',
    purchase_price: p.purchase_price ?? '',
  })
  const [moving, setMoving] = useState(false)
  const [moveTo, setMoveTo] = useState('')
  const [more, setMore] = useState(Boolean(p.vendor || p.purchase_price))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Every empty, usable bay in a local location (not this one).
  const targets = useMemo(() => {
    const out = []
    for (const loc of locations.filter(l => !l.remote)) {
      for (const { array: arr, bays } of loc.arrays) {
        for (const b of bays) {
          if (b.id !== bay?.id && !b.drive_serial && b.status !== 'damaged') {
            out.push({ id: b.id, label: `${loc.name} · ${arr.name} · ${bayLabel(b)}` })
          }
        }
      }
    }
    return out
  }, [locations, bay?.id])

  const defaultLabel = bay ? `${bay.row + 1}-${bay.col + 1}` : ''

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const label = form.label.trim()
      if (!bay) { /* drive not placed: only profile + placement below */ }
      else if (label !== (bay.label || '') && label !== defaultLabel) await setBayLabel(bay.id, label)
      else if (label === defaultLabel && bay.label) await setBayLabel(bay.id, '')

      const wantStatus = form.status === 'damaged' ? 'damaged' : form.status === 'operational' ? form.role : 'normal'
      if (bay && wantStatus !== (bay.status || 'normal')) await setBayStatus(bay.id, wantStatus)

      if (drive) {
        const changes = {}
        const months = form.warranty_years === '' ? null : Math.round(parseFloat(form.warranty_years) * 12)
        if ((form.purchase_date || null) !== (p.purchase_date || null)) changes.purchase_date = form.purchase_date || null
        if (months !== (p.warranty_months ?? null)) changes.warranty_months = Number.isNaN(months) ? null : months
        if ((form.notes || null) !== (p.notes || null)) changes.notes = form.notes || null
        if ((form.vendor || null) !== (p.vendor || null)) changes.vendor = form.vendor || null
        const price = form.purchase_price === '' ? null : parseFloat(form.purchase_price)
        if (price !== (p.purchase_price ?? null)) changes.purchase_price = Number.isNaN(price) ? null : price
        if (Object.keys(changes).length) await upsertProfile(drive.serial, changes)

        if (moving && moveTo) await assignDrive(Number(moveTo), drive.serial)
        else if (bay && form.status === 'empty') await unassignDrive(bay.id)
      }
      await onSaved?.()
      onClose()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Saving failed. Check the connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const where = [location?.name, array?.name].filter(Boolean).join(', ')

  return (
    <Dialog
      title={bay ? 'Edit bay and drive' : 'Edit drive'}
      subtitle={`${bay ? `Bay ${bayLabel(bay)}` : 'Not in a bay'}${drive ? `, ${driveName(drive)}` : ''}`}
      onClose={onClose}
      width={600}
      footer={(
        <div className="flex flex-col gap-3">
          {error && <div className="wt-pill wt-pill--down" role="alert" style={{ borderRadius: 'var(--wt-r-md)', padding: '8px 12px' }}>{error}</div>}
          <div className="flex gap-2.5">
            <button type="button" className="wt-btn wt-btn--secondary bw-btn-lg flex-1 justify-center" onClick={onClose}>Cancel</button>
            <button type="button" className="wt-btn wt-btn--primary bw-btn-lg justify-center disabled:opacity-60" style={{ flex: 1.5 }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    >
      {bay && <fieldset className="flex flex-col gap-3">
        <legend className="wt-eyebrow mb-3" style={{ color: 'var(--bw-ink)' }}>Bay</legend>
        <div className="flex gap-2.5">
          <label className="wt-field" style={{ flex: 1.4 }}>
            <span className="wt-label">Location</span>
            <input className="wt-input" value={where} readOnly aria-readonly="true" style={{ background: 'var(--wt-surface-2)' }} />
          </label>
          <label className="wt-field" style={{ flex: 1 }}>
            <span className="wt-label">Bay</span>
            <input className="wt-input wt-input--mono" value={form.label} placeholder={defaultLabel} maxLength={32}
              onChange={e => set('label', e.target.value)} />
          </label>
        </div>
        <div role="group" aria-label="Bay status" className="bw-seg bw-seg--fill">
          {STATUS_OPTS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={form.status === v} onClick={() => set('status', v)}
              disabled={v === 'operational' && !drive}>{l}</button>
          ))}
        </div>
        {form.status === 'operational' && drive && (
          <label className="wt-field">
            <span className="wt-label">Role</span>
            <select className="wt-select" value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        {form.status === 'empty' && drive && (
          <p className="wt-hint">Saving removes {driveName(drive)} from this bay. The drive stays in BayWatch and can be placed again.</p>
        )}
      </fieldset>}

      {drive && (
        <fieldset className="flex flex-col gap-3">
          <legend className="wt-eyebrow mb-3" style={{ color: 'var(--bw-ink)' }}>Drive</legend>
          <div className="flex gap-2.5">
            <label className="wt-field flex-1">
              <span className="wt-label">Purchased</span>
              <input type="date" className="wt-input wt-input--mono" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
            </label>
            <label className="wt-field flex-1">
              <span className="wt-label">Warranty, years</span>
              <input type="number" min="0" step="0.5" inputMode="decimal" className="wt-input wt-input--mono" value={form.warranty_years}
                placeholder="e.g. 5" onChange={e => set('warranty_years', e.target.value)} />
            </label>
          </div>
          <label className="wt-field">
            <span className="wt-label">Notes</span>
            <textarea rows={2} className="wt-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </label>
          <button type="button" className="inline-flex items-center gap-1 text-[13px] font-semibold self-start" style={{ color: 'var(--wt-text-muted)', minHeight: 32 }}
            aria-expanded={more} onClick={() => setMore(m => !m)}>
            <ChevronDown size={14} aria-hidden="true" style={{ transform: more ? 'rotate(180deg)' : undefined, transition: 'transform var(--wt-dur) var(--wt-ease)' }} />
            Vendor and price
          </button>
          {more && (
            <div className="flex gap-2.5">
              <label className="wt-field flex-1">
                <span className="wt-label">Vendor</span>
                <input className="wt-input" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
              </label>
              <label className="wt-field flex-1">
                <span className="wt-label">Price</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" className="wt-input wt-input--mono" value={form.purchase_price}
                  onChange={e => set('purchase_price', e.target.value)} />
              </label>
            </div>
          )}
        </fieldset>
      )}

      {drive && (
        <div className="flex flex-col gap-2">
          <button type="button" className="wt-btn wt-btn--secondary bw-btn-lg w-full" aria-expanded={moving} onClick={() => setMoving(m => !m)}>
            <span className="flex-1 text-left">{bay ? 'Move drive to another bay or shelf' : 'Place drive in a bay'}</span>
            <ArrowRightLeft size={16} aria-hidden="true" />
          </button>
          {moving && (
            targets.length ? (
              <label className="wt-field">
                <span className="wt-label">Move to</span>
                <select className="wt-select" value={moveTo} onChange={e => setMoveTo(e.target.value)}>
                  <option value="">Choose an empty bay…</option>
                  {targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
            ) : (
              <p className="wt-hint">There are no empty bays. Free one up or add a computer or shelf in Settings.</p>
            )
          )}
        </div>
      )}
    </Dialog>
  )
}
