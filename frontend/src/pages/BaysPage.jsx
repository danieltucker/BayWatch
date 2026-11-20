import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HardDrive } from 'lucide-react'
import AppHeader from '../components/shell/AppHeader'
import Hero from '../components/bays/Hero'
import Widgets from '../components/bays/Widgets'
import {
  COLOR_OPTS, DENSITY_OPTS, Legend, LocationBody, LocationSwitcher, legendItems, locationTitle,
} from '../components/bays/Chassis'
import { AttentionBanner, NeedsAttention, PoolCapacity, TempSpread } from '../components/bays/Panels'
import DrivePanel from '../components/bays/DrivePanel'
import EditBayDriveSheet from '../components/EditBayDriveSheet'
import { DriveCard, DriveHistoryModal, EmptyBayModal, PoolTopologyPanel } from '../lazy'
import { Spinner, StatusPill } from '../components/ui/bits'
import { useFleet } from '../context/FleetContext'
import { useShell } from '../context/ShellContext'
import { useTempThresholds } from '../context/TempThresholdContext'
import { useIsMobile } from '../hooks/useMediaQuery'
import { getArrayTempHistory, getRemoteDriveHistory } from '../api/client'
import {
  attentionItems, bayLabel, fleetSummary, heroCopy, poolGroups, tempSpread,
} from '../lib/fleet'
import { driveName, fmtCap } from '../lib/format'
import { exportDrivesCSV } from '../lib/export'

function usePersisted(key, initial, allowed) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(key)
      return s && (!allowed || allowed.includes(s)) ? s : initial
    } catch { return initial }
  })
  const set = next => { setV(next); try { localStorage.setItem(key, next) } catch { /* ignore */ } }
  return [v, set]
}

/** Daily average temperature across local arrays, for the featured widget sparkline. */
function useFleetTempSpark(arrayIds) {
  const [vals, setVals] = useState([])
  const key = arrayIds.join(',')
  useEffect(() => {
    if (!arrayIds.length) return
    let alive = true
    Promise.all(arrayIds.map(id => getArrayTempHistory(id, 30).catch(() => []))).then(lists => {
      const byDate = {}
      for (const list of lists) for (const r of list) (byDate[r.date] ||= []).push(r.avg_temp_c)
      const out = Object.keys(byDate).sort().map(d => byDate[d].reduce((a, b) => a + b, 0) / byDate[d].length)
      if (alive) setVals(out)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return vals
}

function Seg({ label, opts, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="bw-seg">
      {opts.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export default function BaysPage() {
  const fleet = useFleet()
  const { openSettings } = useShell()
  const thresholds = useTempThresholds()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const chassisRef = useRef(null)

  const [query, setQuery] = useState('')
  const [colorBy, setColorBy] = usePersisted('bays-color-by', 'health', ['health', 'temp', 'pool'])
  const [density, setDensity] = usePersisted('bays-density', 'comfortable', ['compact', 'comfortable'])
  const [storedLoc, setStoredLoc] = usePersisted('bays-location', '')
  const [editing, setEditing] = useState(null)
  const [historyFor, setHistoryFor] = useState(null)
  const [emptyBay, setEmptyBay] = useState(null)
  const [remoteSel, setRemoteSel] = useState(null)
  const [remoteHistory, setRemoteHistory] = useState(null)

  const { drives, driveMap, profileMap, locations, placement, bayBySerial, pools, topology, lastRefreshed } = fleet

  const location = locations.find(l => l.id === (params.get('loc') || storedLoc)) || locations[0] || null
  const q = query.trim().toLowerCase()

  // Selected bay: from the URL, else the first populated bay of this location.
  const bayParam = Number(params.get('bay'))
  const locBays = location && !location.remote ? location.arrays.flatMap(a => a.bays.map(b => ({ array: a.array, bay: b }))) : []
  const sel = locBays.find(x => x.bay.id === bayParam) || locBays.find(x => x.bay.drive_serial && driveMap[x.bay.drive_serial])
  const selDrive = sel?.bay.drive_serial ? driveMap[sel.bay.drive_serial] : null

  // One palette for the whole fleet so a vdev keeps its colour in the map, legend and pool card.
  const fleetGroups = useMemo(() => poolGroups(drives, bayBySerial), [drives, bayBySerial])
  const groups = useMemo(() => (location?.remote ? poolGroups(Object.values(location.driveMap)) : fleetGroups), [location, fleetGroups])
  const attention = useMemo(() => attentionItems({ drives, locations, thresholds }), [drives, locations, thresholds])
  const summary = useMemo(() => fleetSummary(drives), [drives])
  const primary = locations.find(l => !l.remote && l.kind === 'server') || locations.find(l => !l.remote)
  const copy = heroCopy({ summary, attention, primaryName: primary?.name })
  const spread = useMemo(() => tempSpread(drives, d => (placement[d.serial] ? bayLabel(placement[d.serial].bay) : d.serial)), [drives, placement])
  const localArrayIds = useMemo(() => locations.filter(l => !l.remote).flatMap(l => l.arrays.map(a => a.array.id)), [locations])
  const spark = useFleetTempSpark(localArrayIds)
  const widgetCtx = useMemo(() => ({ drives, driveMap, profiles: fleet.profiles, locations, placement, pools, thresholds }),
    [drives, driveMap, fleet.profiles, locations, placement, pools, thresholds])
  const tileCtx = { groups, thresholds }

  useEffect(() => {
    if (!remoteSel) { setRemoteHistory(null); return }
    getRemoteDriveHistory(remoteSel.targetId, remoteSel.drive.serial, 90)
      .then(setRemoteHistory)
      .catch(() => setRemoteHistory({ history: [], error: 'Failed to fetch history' }))
  }, [remoteSel])

  function pickLocation(id) {
    setStoredLoc(id)
    setParams(p => { const n = new URLSearchParams(p); n.set('loc', id); n.delete('bay'); return n }, { replace: true })
  }
  function pickBay(bay, drive) {
    if (location?.remote) {
      setRemoteSel({ drive, targetId: location.targetId, instanceName: location.name })
      return
    }
    setParams(p => { const n = new URLSearchParams(p); n.set('loc', location.id); n.set('bay', String(bay.id)); return n }, { replace: true })
  }
  function onEmpty(bay) {
    const drive = bay.drive_serial ? driveMap[bay.drive_serial] : null
    if (drive) openEdit(bay, drive)
    else setEmptyBay(bay)
  }
  function openEdit(bay, drive) {
    const arr = location.arrays.find(a => a.bays.some(b => b.id === bay.id))
    setEditing({ bay, drive, array: arr?.array })
  }
  function scrollToChassis() {
    chassisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function openAttention(item) {
    const to = item.to
    if (to.kind === 'bay') { pickLocation(to.locationId); setColorBy('health'); scrollToChassis() }
    else if (to.kind === 'colorBy') { setColorBy(to.value); scrollToChassis() }
    else if (to.kind === 'drives') navigate(`/drives?status=${to.filter}`)
    else if (to.kind === 'reports') navigate(`/reports?tab=${to.tab}`)
  }

  const header = (hero) => (
    <AppHeader search={{ value: query, onChange: setQuery }} hideScan>
      {hero}
    </AppHeader>
  )

  if (fleet.loading) {
    return <div className="bw-page">{header(null)}<Spinner label="Loading drives…" /></div>
  }

  const heroEl = (
    <Hero copy={copy} summary={summary} drives={drives} location={primary} lastRefreshed={lastRefreshed}
      onExport={() => exportDrivesCSV(drives, profileMap, placement)} />
  )

  const t = location ? locationTitle(location) : null
  const chassis = location ? (
    <section ref={chassisRef} aria-label="Chassis" className={isMobile ? 'flex flex-col gap-3' : 'bw-card bw-card--pad flex flex-col gap-5'}
      data-screen-label="Chassis map" style={{ scrollMarginTop: 16 }}>
      <div className="bw-card__head">
        <div className="min-w-0">
          <span className="wt-eyebrow">{location.remote ? 'Remote instance' : location.kind === 'shelf' ? 'Disk shelf' : 'Chassis'} · {location.name}</span>
          <div className="flex items-center gap-2.5 flex-wrap mt-1.5">
            <h2 className="bw-h2" style={{ fontSize: isMobile ? 'var(--wt-text-md)' : 'var(--wt-text-xl)' }}>{t.title}</h2>
            {t.chip && <span className="wt-chip wt-chip--plain">{t.chip}</span>}
          </div>
          <div className="bw-sub">{t.sub}</div>
        </div>
        {!location.offline && (
          <div className="flex flex-wrap gap-2.5 items-center">
            <Seg label="Color by" opts={COLOR_OPTS} value={colorBy} onChange={setColorBy} />
            {!isMobile && <Seg label="Tile size" opts={DENSITY_OPTS} value={density} onChange={setDensity} />}
          </div>
        )}
      </div>
      {!location.offline && <Legend items={legendItems(colorBy, location, tileCtx)} />}
      {!isMobile && locations.length > 0 && (
        <LocationSwitcher locations={locations} activeId={location.id} onPick={pickLocation} onAdd={openSettings} />
      )}
      {location.remote && (
        <div className="bw-note">
          Read-only view of <span className="wt-mono">{location.url}</span>, synced {location.fetchedAt ? new Date(location.fetchedAt).toLocaleString() : 'never'}.
        </div>
      )}
      <LocationBody location={location} colorBy={colorBy} density={isMobile ? 'compact' : density} query={q}
        selectedBayId={sel?.bay.id} onPick={pickBay} onEmpty={onEmpty} ctx={tileCtx} isMobile={isMobile} />
    </section>
  ) : (
    <section className="bw-card bw-card--pad flex flex-col items-center text-center gap-4 py-16">
      <span className="wt-appicon" style={{ '--ai-size': '56px', '--ai-from': 'var(--bw-from)', '--ai-to': 'var(--bw-to)' }}><HardDrive aria-hidden="true" /></span>
      <div>
        <p className="font-semibold mb-1">No enclosures yet</p>
        <p className="bw-sub">Add your first computer or shelf and its bay array in Settings.</p>
      </div>
      <button type="button" className="wt-btn wt-btn--primary bw-btn-lg" onClick={openSettings}>Open Settings</button>
    </section>
  )

  // PoolTopologyPanel has its own collapsible header (state remembered in localStorage).
  const topologySection = topology.length > 0 && (
    <Suspense fallback={null}>
      <PoolTopologyPanel poolTopology={topology} poolStats={pools} driveMap={driveMap}
        onDriveSelect={serial => {
          const p = placement[serial]
          if (p) {
            setStoredLoc(p.location.id)
            setParams(x => { const n = new URLSearchParams(x); n.set('loc', p.location.id); n.set('bay', String(p.bay.id)); return n }, { replace: true })
            scrollToChassis()
          } else navigate(`/drives/${encodeURIComponent(serial)}`)
        }} />
    </Suspense>
  )

  const modals = (
    <Suspense fallback={null}>
      {editing && (
        <EditBayDriveSheet bay={editing.bay} drive={editing.drive} profile={editing.drive ? profileMap[editing.drive.serial] : null}
          location={location} array={editing.array} locations={locations}
          onClose={() => setEditing(null)} onSaved={fleet.refresh} />
      )}
      {historyFor && (
        <DriveHistoryModal serial={historyFor.serial} make={historyFor.make} model={historyFor.model} onClose={() => setHistoryFor(null)} />
      )}
      {emptyBay && (
        <EmptyBayModal bay={emptyBay}
          drives={[...drives].sort((a, b) => Number(!!placement[a.serial]) - Number(!!placement[b.serial]))}
          onClose={() => setEmptyBay(null)} onCreated={() => { setEmptyBay(null); fleet.refresh() }} />
      )}
      {remoteSel && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70" onClick={() => setRemoteSel(null)} />
          <div className="flex min-h-full items-start justify-center p-4 pt-16">
            <div className="relative w-full max-w-md">
              <DriveCard drive={remoteSel.drive} remote instanceName={remoteSel.instanceName}
                remoteHistory={remoteHistory?.history ?? null} remoteHistoryError={remoteHistory?.error ?? null}
                onClose={() => setRemoteSel(null)} />
            </div>
          </div>
        </div>
      )}
    </Suspense>
  )

  if (isMobile) {
    return (
      <div className={`bw-page ${selDrive ? 'bw-page--peek' : ''}`} data-screen-label="Bays (mobile)">
        {header(null)}
        <section className="bw-band" aria-label="Fleet health">{heroEl}</section>
        <Widgets ctx={widgetCtx} spark={spark} />
        <AttentionBanner items={attention} onOpen={openAttention} />
        {locations.length > 0 && <LocationSwitcher locations={locations} activeId={location?.id} onPick={pickLocation} onAdd={openSettings} />}
        {chassis}
        <div className="bw-quad">
          <div className="bw-stat"><div className="bw-stat__label">Capacity</div><div className="bw-metric bw-stat__value">{fmtCap(drives.reduce((s, d) => s + (d.capacity_bytes || 0), 0))}</div></div>
          <div className="bw-stat"><div className="bw-stat__label">Needs attention</div><div className="bw-metric bw-stat__value">{attention.length}</div></div>
        </div>
        <TempSpread spread={spread} thresholds={thresholds} />
        <PoolCapacity pools={pools} drives={drives} bayBySerial={bayBySerial} groups={fleetGroups} />
        {selDrive && (
          <div className="bw-card fixed z-30 flex items-center gap-3" data-screen-label="Selected drive peek"
            style={{ left: 12, right: 12, bottom: 'calc(var(--bw-tabbar-h) + 8px)', padding: '12px 12px 12px 16px', boxShadow: 'var(--wt-shadow-lg)' }}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold" style={{ color: 'var(--wt-text-muted)' }}>
                Bay <span className="wt-mono">{bayLabel(sel.bay)}</span>{selDrive.vdev_name ? <>, <span className="wt-mono">{selDrive.vdev_name}</span></> : null}
              </div>
              <div className="font-bold truncate">{driveName(selDrive)}</div>
              <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>
                <span className="wt-mono">{selDrive.temperature_c != null ? `${selDrive.temperature_c}°C` : '—'}, {fmtCap(selDrive.capacity_bytes)}</span>
                <StatusPill drive={selDrive} />
              </div>
            </div>
            <Link to={`/drives/${encodeURIComponent(selDrive.serial)}`} className="wt-btn wt-btn--primary bw-btn-lg">Details</Link>
          </div>
        )}
        {modals}
      </div>
    )
  }

  return (
    <div className="bw-page" data-screen-label="Bays">
      {header(heroEl)}
      <Widgets ctx={widgetCtx} spark={spark} />
      <div className="bw-split">
        <div className="bw-stack">
          {chassis}
          <TempSpread spread={spread} thresholds={thresholds} />
          {topologySection}
        </div>
        <div className="bw-stack">
          {!location?.remote && (
            <DrivePanel drive={selDrive} bay={sel?.bay} location={location}
              onEdit={() => openEdit(sel.bay, selDrive)} onHistory={() => setHistoryFor(selDrive)} />
          )}
          <NeedsAttention items={attention} total={drives.length} onOpen={openAttention} />
          <PoolCapacity pools={pools} drives={drives} bayBySerial={bayBySerial} groups={fleetGroups} />
        </div>
      </div>
      {modals}
    </div>
  )
}
