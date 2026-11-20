import { Suspense, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import AppHeader from '../components/shell/AppHeader'
import { DriveStats, DriveTags, HealthBlock, TempHistory, useDriveHistory } from '../components/bays/DrivePanel'
import EditBayDriveSheet from '../components/EditBayDriveSheet'
import { DriveCard, DriveHistoryModal } from '../lazy'
import { Kv, Spinner, StatusPill } from '../components/ui/bits'
import { useFleet } from '../context/FleetContext'
import { deleteDrive } from '../api/client'
import { bayLabel, isSpare } from '../lib/fleet'
import { driveKind, driveName, fmtCap, fmtDate, fmtTB, formFactorLabel } from '../lib/format'

function warrantyText(p) {
  if (!p?.warranty_months) return '—'
  const yrs = p.warranty_months / 12
  const len = Number.isInteger(yrs) ? `${yrs} ${yrs === 1 ? 'year' : 'years'}` : `${p.warranty_months} months`
  if (!p.warranty_expiry) return len
  const left = p.warranty_days_remaining
  return `${len}, to ${fmtDate(p.warranty_expiry)}${left != null && left < 0 ? ' (expired)' : ''}`
}

export default function DriveDetail() {
  const { serial } = useParams()
  const navigate = useNavigate()
  const fleet = useFleet()
  const [editing, setEditing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const drive = fleet.driveMap[serial]
  const history = useDriveHistory(drive ? serial : null)

  if (fleet.loading) return <div className="bw-page"><AppHeader /><Spinner /></div>
  if (!drive) {
    return (
      <div className="bw-page">
        <AppHeader />
        <section className="bw-card bw-card--pad text-center flex flex-col items-center gap-3 py-12">
          <h1 className="bw-h2">Drive not found</h1>
          <p className="bw-sub">No drive with serial <span className="wt-mono">{serial}</span> is known to BayWatch.</p>
          <Link to="/drives" className="wt-btn wt-btn--secondary">All drives</Link>
        </section>
      </div>
    )
  }

  const place = fleet.placement[drive.serial]
  const profile = fleet.profileMap[drive.serial]
  const pool = fleet.pools.find(p => p.name === drive.zfs_pool)
  const backTo = place ? `/?loc=${place.location.id}&bay=${place.bay.id}` : '/drives'
  const where = place ? `${place.location.name}, Bay ${bayLabel(place.bay)}` : 'Not in a bay'

  return (
    <div className="bw-page" data-screen-label="Drive detail" style={{ maxWidth: 880 }}>
      <AppHeader />
      <div className="flex items-center gap-3">
        <Link to={backTo} className="bw-iconbtn" aria-label={place ? 'Back to bays' : 'Back to drives'}>
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold" style={{ color: 'var(--wt-text-muted)' }}>{where}</div>
          <h1 className="bw-h1 truncate" style={{ fontSize: 'var(--wt-text-xl)' }}>{driveName(drive)}</h1>
        </div>
        {place && isSpare(drive, place.bay) && <span className="wt-chip wt-chip--plain">Spare</span>}
        <StatusPill drive={drive} />
      </div>

      <section className="bw-card bw-card--pad flex flex-col gap-4">
        <HealthBlock drive={drive} history={history} size={76} />
        <DriveTags drive={drive} />
      </section>

      <DriveStats drive={drive} history={history} />

      <section className="bw-card bw-card--pad"><TempHistory history={history} /></section>

      {pool && (
        <section className="bw-card bw-card--pad flex flex-col gap-2" style={{ background: 'color-mix(in oklch, var(--wt-viz-1) 7%, var(--wt-surface))' }}>
          <div className="flex justify-between items-center">
            <span className="font-semibold">{pool.name}</span>
            <span className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>{drive.vdev_name || 'pool member'}</span>
          </div>
          <div className="wt-meter" style={{ height: 6 }}>
            <div className="wt-meter__fill" style={{ width: `${pool.capacity_pct}%`, background: pool.capacity_pct >= 90 ? 'var(--wt-down-500)' : pool.capacity_pct >= 80 ? 'var(--wt-warn-500)' : 'var(--wt-viz-1)' }} />
          </div>
          <div className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>
            {pool.capacity_pct}% used, {fmtTB(pool.alloc_bytes)} of {fmtTB(pool.size_bytes)}
          </div>
        </section>
      )}

      <section className="bw-card" style={{ padding: '4px 20px' }} aria-label="Drive details">
        <div style={{ marginTop: -1 }}>
          <Kv k="Serial" v={drive.serial} mono />
          <Kv k="Device" v={drive.device_path || '—'} mono />
          <Kv k="Type" v={[fmtCap(drive.capacity_bytes), driveKind(drive), formFactorLabel(drive.form_factor)].filter(Boolean).join(', ')} />
          <Kv k="Firmware" v={drive.firmware_version || '—'} mono />
          <Kv k="Purchased" v={fmtDate(profile?.purchase_date)} />
          <Kv k="Warranty" v={warrantyText(profile)} />
          {profile?.vendor && <Kv k="Vendor" v={profile.vendor} />}
          <div className="py-3" style={{ borderTop: '1px solid var(--wt-border)' }}>
            <div className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>Notes</div>
            <div className="mt-0.5 text-sm">{profile?.notes || <span style={{ color: 'var(--wt-text-faint)' }}>None</span>}</div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <button type="button" className="wt-btn wt-btn--ghost self-start" aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}>
          <ChevronDown size={15} aria-hidden="true" style={{ transform: moreOpen ? 'rotate(180deg)' : undefined, transition: 'transform var(--wt-dur) var(--wt-ease)' }} />
          SMART, partitions and I/O
        </button>
        {moreOpen && (
          <Suspense fallback={<Spinner />}>
          <DriveCard drive={drive} profile={profile} bay={place?.bay} poolStats={fleet.pools}
            onDelete={async s => { await deleteDrive(s); await fleet.refresh(); navigate('/drives') }} />
          </Suspense>
        )}
      </section>

      <div className="bw-actionbar">
        <div className="bw-card flex gap-2.5 w-full" style={{ padding: 10, boxShadow: 'var(--wt-shadow-lg)' }}>
          <button type="button" className="wt-btn wt-btn--secondary bw-btn-lg flex-1 justify-center" onClick={() => setHistoryOpen(true)}>History</button>
          <button type="button" className="wt-btn wt-btn--primary bw-btn-lg justify-center disabled:opacity-60" style={{ flex: 1.6 }}
            onClick={() => setEditing(true)}>
            {place ? 'Edit bay and drive' : 'Edit drive'}
          </button>
        </div>
      </div>

      {editing && (
        <EditBayDriveSheet bay={place?.bay ?? null} drive={drive} profile={profile} location={place?.location} array={place?.array}
          locations={fleet.locations} onClose={() => setEditing(false)} onSaved={fleet.refresh} />
      )}
      {historyOpen && (
        <Suspense fallback={null}>
          <DriveHistoryModal serial={drive.serial} make={drive.make} model={drive.model} onClose={() => setHistoryOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
