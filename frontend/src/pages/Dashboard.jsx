import { useEffect, useState, useCallback, useRef } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Server, HardDrive, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Download, X, LayoutGrid, List, BarChart2 } from 'lucide-react'
import DrivesPage from './DrivesPage'
import Reports from './Reports'
import { getDriveIcon } from '../utils/driveIcon'
import clsx from 'clsx'
import BayGrid from '../components/BayGrid'
import DriveCard from '../components/DriveCard'
import DriveList from '../components/DriveList'
import BayModal from '../components/BayModal'
import SettingsModal from '../components/SettingsModal'
import ScanButton from '../components/ScanButton'
import WidgetBar from '../components/WidgetBar'
import PoolTopologyPanel from '../components/PoolTopologyPanel'
import {
  getEnclosures, getDrives, getBays, getProfile, getAllProfiles, assignDrive,
  getPools, getPoolTopology, updateEnclosure, updateBayArray,
  getFederationData, deleteDrive, getRemoteDriveHistory,
} from '../api/client'

function exportDrivesCSV(drives, profiles, enclosures, baysMap) {
  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))

  // Build serial → { enclosureName, arrayName, bayLabel } from enclosures + baysMap
  const bayLocMap = {}
  for (const enc of (enclosures || [])) {
    for (const arr of (enc.arrays || [])) {
      for (const bay of (baysMap[arr.id] || [])) {
        if (bay.drive_serial) {
          bayLocMap[bay.drive_serial] = {
            enclosureName: enc.name,
            arrayName: arr.name,
            bayLabel: bay.label || `R${bay.row + 1}C${bay.col + 1}`,
          }
        }
      }
    }
  }

  const headers = [
    'Serial', 'Make', 'Model', 'Capacity', 'Form Factor', 'RPM', 'Firmware',
    'Device Path', 'SMART Status', 'Temperature (C)', 'Power On Hours',
    'Reallocated Sectors', 'Pending Sectors', 'Uncorrectable Errors',
    'ZFS Pool', 'vDev', 'Last Scanned',
    'Purchase Date', 'Warranty (months)', 'Vendor', 'Notes',
    'Enclosure', 'Array', 'Bay',
  ]
  const rows = drives.map(d => {
    const p = profileMap[d.serial] || {}
    const loc = bayLocMap[d.serial] || {}
    const cap = d.capacity_bytes
      ? d.capacity_bytes >= 1e12
        ? `${(d.capacity_bytes / 1e12).toFixed(1)} TB`
        : `${(d.capacity_bytes / 1e9).toFixed(0)} GB`
      : ''
    return [
      d.serial, d.make || '', d.model || '', cap,
      d.form_factor || '', d.rpm != null ? d.rpm : '', d.firmware_version || '',
      d.device_path || '', d.smart_status || '',
      d.temperature_c != null ? d.temperature_c : '',
      d.power_on_hours != null ? d.power_on_hours : '',
      d.reallocated_sectors != null ? d.reallocated_sectors : '',
      d.pending_sectors != null ? d.pending_sectors : '',
      d.uncorrectable_errors != null ? d.uncorrectable_errors : '',
      d.zfs_pool || '', d.vdev_name || '',
      d.last_scanned ? new Date(d.last_scanned).toISOString() : '',
      p.purchase_date || '', p.warranty_months != null ? p.warranty_months : '',
      p.vendor || '', p.notes ? `"${p.notes.replace(/"/g, '""')}"` : '',
      loc.enclosureName || '', loc.arrayName || '', loc.bayLabel || '',
    ].map(v => String(v).includes(',') ? `"${v}"` : v)
  })
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `baywatch-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function relativeTime(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} min ago`
}

export default function Dashboard({ onOpenLog, onOpenSettings, settingsOpen, onCloseSettings }) {
  const [enclosures, setEnclosures] = useState([])
  const [drives, setDrives] = useState([])
  const [baysMap, setBaysMap] = useState({})
  const [profiles, setProfiles] = useState([])
  const [selectedBay, setSelectedBay] = useState(null)
  const [selectedDriveSerial, setSelectedDriveSerial] = useState(null)
  const [hoveredBay, setHoveredBay] = useState(null)
  const [bayModal, setBayModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeDriveSerial, setActiveDriveSerial] = useState(null)
  const [poolStats, setPoolStats] = useState([])
  const [poolTopology, setPoolTopology] = useState([])
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [, setTick] = useState(0)
  const [collapsedEncs, setCollapsedEncs] = useState({})
  const [federationData, setFederationData] = useState([])
  const [collapsedFederation, setCollapsedFederation] = useState(false)
  const [collapsedRemotes, setCollapsedRemotes] = useState({})
  const [selectedRemoteDrive, setSelectedRemoteDrive] = useState(null)
  const [remoteHistory, setRemoteHistory] = useState(null)
  const [hoveredRemoteDrive, setHoveredRemoteDrive] = useState(null)
  const [remoteViewModes, setRemoteViewModes] = useState({})
  const [toasts, setToasts] = useState([])
  const [activeView, setActiveView] = useState('bays')
  const prevConnectedRef = useRef(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const driveMap = Object.fromEntries(drives.map(d => [d.serial, d]))
  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))

  const assignedSerials = new Set(
    Object.values(baysMap).flatMap(bays => bays.map(b => b.drive_serial).filter(Boolean))
  )

  const loadAll = useCallback(async () => {
    try {
      const [encs, drvs, pools, topology, fedData] = await Promise.all([
        getEnclosures(),
        getDrives(),
        getPools().catch(() => []),
        getPoolTopology().catch(() => []),
        getFederationData().catch(() => []),
      ])
      setFederationData(fedData)
      setPoolStats(pools)
      setPoolTopology(topology)
      setEnclosures(encs)
      setDrives(drvs)

      if (prevConnectedRef.current) {
        for (const d of drvs) {
          if (!d.is_connected && prevConnectedRef.current.get(d.serial) === true) {
            const id = Date.now() + Math.random()
            const label = [d.make, d.model].filter(Boolean).join(' ') || d.serial
            setToasts(prev => [...prev, { id, label, serial: d.serial }])
            setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 8000)
          }
        }
      }
      prevConnectedRef.current = new Map(drvs.map(d => [d.serial, d.is_connected !== false]))

      const allArrayIds = encs.flatMap(e => e.arrays.map(a => a.id))
      const bayResults = await Promise.all(allArrayIds.map(id => getBays(id)))
      const newBaysMap = {}
      allArrayIds.forEach((id, i) => { newBaysMap[id] = bayResults[i] })
      setBaysMap(newBaysMap)

      const profileData = await getAllProfiles().catch(() => [])
      setProfiles(profileData)

      // Initialize collapse state from localStorage on first load
      setCollapsedEncs(prev => {
        const next = { ...prev }
        for (const enc of encs) {
          if (!(enc.id in next)) {
            next[enc.id] = localStorage.getItem(`enc-collapsed-${enc.id}`) === 'true'
          }
        }
        return next
      })
    } finally {
      setLoading(false)
      setLastRefreshed(new Date())
    }
  }, [])

  useEffect(() => {
    loadAll()
    const refresh = setInterval(loadAll, 5 * 60 * 1000)
    const tick = setInterval(() => setTick(n => n + 1), 60 * 1000)
    return () => { clearInterval(refresh); clearInterval(tick) }
  }, [loadAll])

  useEffect(() => {
    if (!selectedRemoteDrive) { setRemoteHistory(null); return }
    getRemoteDriveHistory(selectedRemoteDrive.targetId, selectedRemoteDrive.drive.serial, 90)
      .then(data => setRemoteHistory(data))
      .catch(() => setRemoteHistory({ history: [], error: 'Failed to fetch history' }))
  }, [selectedRemoteDrive])

  function toggleRemoteView(targetId) {
    setRemoteViewModes(prev => {
      const current = prev[targetId] ?? localStorage.getItem(`fed-view-${targetId}`) ?? 'grid'
      const next = current === 'list' ? 'grid' : 'list'
      localStorage.setItem(`fed-view-${targetId}`, next)
      return { ...prev, [targetId]: next }
    })
  }

  function getRemoteView(targetId) {
    return remoteViewModes[targetId] ?? localStorage.getItem(`fed-view-${targetId}`) ?? 'grid'
  }

  function findArrayName(bayId) {
    if (!bayId) return null
    for (const enc of enclosures) {
      for (const arr of enc.arrays) {
        if ((baysMap[arr.id] || []).some(b => b.id === bayId)) return arr.name
      }
    }
    return null
  }

  function toggleEncCollapse(encId) {
    setCollapsedEncs(prev => {
      const next = !prev[encId]
      localStorage.setItem(`enc-collapsed-${encId}`, String(next))
      return { ...prev, [encId]: next }
    })
  }

  async function moveEnclosure(idx, dir) {
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= enclosures.length) return
    const updates = enclosures.map((enc, i) => {
      let order = i
      if (i === idx) order = swapIdx
      else if (i === swapIdx) order = idx
      return updateEnclosure(enc.id, { name: enc.name, type: enc.type, display_order: order })
    })
    await Promise.all(updates)
    loadAll()
  }

  async function moveArray(enc, arrIdx, dir) {
    const swapIdx = arrIdx + dir
    if (swapIdx < 0 || swapIdx >= enc.arrays.length) return
    const updates = enc.arrays.map((arr, i) => {
      let order = i
      if (i === arrIdx) order = swapIdx
      else if (i === swapIdx) order = arrIdx
      return updateBayArray(enc.id, arr.id, { display_order: order })
    })
    await Promise.all(updates)
    loadAll()
  }

  const handleDriveSelect = (serial) => {
    setSelectedDriveSerial(serial)
    setSelectedBay(null)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveDriveSerial(null)
    if (!over) return
    const serial = active.data.current?.serial
    const bayId = over.id
    if (!serial || !bayId) return
    try {
      await assignDrive(bayId, serial)
      loadAll()
    } catch (e) {
      console.error('Assignment failed', e)
    }
  }

  const selectedDrive = selectedBay?.drive_serial
    ? driveMap[selectedBay.drive_serial]
    : selectedDriveSerial
    ? driveMap[selectedDriveSerial]
    : null
  const selectedProfile = selectedDrive ? profileMap[selectedDrive.serial] : null

  const hoveredDrive = hoveredBay?.drive_serial ? driveMap[hoveredBay.drive_serial] : null
  const displayBay    = hoveredBay ?? selectedBay
  const displayDrive  = hoveredDrive ?? selectedDrive
  const displayProfile = displayDrive ? profileMap[displayDrive.serial] : null
  const highlightVdev = displayDrive?.vdev_name ?? null

  const activeDrive = activeDriveSerial ? driveMap[activeDriveSerial] : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ color: 'var(--wt-text-faint)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--wt-brand-100)', borderTopColor: 'var(--wt-brand-500)' }} />
        <span className="text-sm">Loading drives…</span>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={e => setActiveDriveSerial(e.active.data.current?.serial)}
      onDragEnd={handleDragEnd}
    >
      {/* ── Disconnect toasts ── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 min-w-[240px]" style={{ background: 'var(--wt-warn-50)', border: '1px solid var(--wt-warn-100)', boxShadow: 'var(--wt-shadow-md)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--wt-warn-700)' }}>{t.label}</p>
                <p className="text-[10px]" style={{ color: 'var(--wt-warn-600)' }}>Drive no longer detected</p>
              </div>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="shrink-0" style={{ color: 'var(--wt-text-faint)' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 49px)' }}>

        {/* Left sidebar */}
        <div className="w-[300px] shrink-0 flex flex-col overflow-hidden" style={{ background: 'var(--wt-surface)', borderRight: '1px solid var(--wt-border)' }}>
          <nav className="flex flex-col gap-0.5 px-2 py-3" style={{ borderBottom: '1px solid var(--wt-border)' }}>
            <span className="wt-eyebrow px-2 mb-1">Views</span>
            {[
              { key: 'bays',    label: 'Bays',    Icon: LayoutGrid },
              { key: 'drives',  label: 'Drives',  Icon: HardDrive },
              { key: 'reports', label: 'Reports', Icon: BarChart2 },
            ].map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setActiveView(key)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left"
                style={activeView === key
                  ? { background: 'color-mix(in oklch, var(--wt-brand-500) 10%, transparent)', color: 'var(--wt-brand-600)', fontWeight: 600 }
                  : { color: 'var(--wt-text-muted)' }
                }>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
          {activeView === 'bays' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                <span className="wt-eyebrow">
                  {hoveredRemoteDrive ? 'Remote Drive' : displayDrive ? 'Drive Details' : 'All Drives'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {hoveredRemoteDrive ? (
                  <DriveCard drive={hoveredRemoteDrive.drive} remote instanceName={hoveredRemoteDrive.instanceName} />
                ) : displayDrive ? (
                  <DriveCard
                    drive={displayDrive}
                    profile={displayProfile}
                    bay={displayBay}
                    poolStats={poolStats}
                    onEdit={selectedBay ? () => setBayModal({
                      bay: selectedBay,
                      drive: selectedDrive,
                      profile: selectedProfile,
                      arrayName: findArrayName(selectedBay?.id),
                    }) : undefined}
                    onClose={selectedDrive ? () => { setSelectedBay(null); setSelectedDriveSerial(null) } : undefined}
                    onDelete={selectedDrive ? async (serial) => {
                      await deleteDrive(serial)
                      setSelectedBay(null)
                      setSelectedDriveSerial(null)
                      loadAll()
                    } : undefined}
                    onReassign={undefined}
                  />
                ) : (
                  <DriveList
                    drives={drives}
                    profiles={profiles}
                    selectedSerial={selectedDriveSerial}
                    onSelect={serial => { setSelectedDriveSerial(serial); setSelectedBay(null) }}
                    assignedSerials={assignedSerials}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto flex flex-col">
          {activeView === 'bays' && <>

          <WidgetBar drives={drives} profiles={profiles} baysMap={baysMap} />

          {/* Enclosure area */}
          <div className="flex-1 p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="wt-eyebrow">{enclosures.length > 0 ? 'Enclosures' : 'Getting Started'}</span>
              <div className="flex items-center gap-3">
                {lastRefreshed && (
                  <span className="wt-mono text-[11px]" style={{ color: 'var(--wt-text-faint)' }}>
                    Updated {relativeTime(lastRefreshed)}
                  </span>
                )}
                {drives.length > 0 && (
                  <button
                    onClick={() => exportDrivesCSV(drives, profiles, enclosures, baysMap)}
                    className="wt-btn wt-btn--ghost wt-btn--sm"
                    title="Export drives to CSV"
                  >
                    <Download size={12} />
                    Export
                  </button>
                )}
                <ScanButton onScanComplete={() => { loadAll(); setLastRefreshed(new Date()) }} onOpenLog={onOpenLog} />
              </div>
            </div>

            {enclosures.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-dashed p-16 text-center gap-4" style={{ border: '1px dashed var(--wt-border-strong)', background: 'var(--wt-surface)' }}>
                <span className="wt-appicon" style={{ '--ai-size': '56px', '--ai-from': 'var(--bw-from)', '--ai-to': 'var(--bw-to)' }}>
                  <HardDrive size={26} />
                </span>
                <div>
                  <p className="font-semibold mb-1" style={{ color: 'var(--wt-text)' }}>No enclosures yet</p>
                  <p className="text-sm" style={{ color: 'var(--wt-text-subtle)' }}>
                    Go to{' '}
                    <button onClick={onOpenSettings} className="underline underline-offset-2" style={{ color: 'var(--bw-ink)' }}>
                      Settings
                    </button>{' '}
                    to add your first enclosure and bay array.
                  </p>
                </div>
              </div>
            )}

            {enclosures.map((enc, encIdx) => {
              const isCollapsed = collapsedEncs[enc.id] ?? false
              return (
                <div
                  key={enc.id}
                  className="wt-card overflow-hidden"
                >
                  {/* Enclosure header */}
                  <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--wt-border)', background: 'var(--wt-surface-2)' }}>
                    <button
                      onClick={() => toggleEncCollapse(enc.id)}
                      className="shrink-0 transition-colors"
                      style={{ color: 'var(--wt-text-faint)' }}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--wt-surface-3)' }}>
                      <Server size={13} style={{ color: 'var(--wt-text-subtle)' }} />
                    </div>
                    <h2 className="font-semibold text-sm flex-1" style={{ color: 'var(--wt-text)' }}>{enc.name}</h2>
                    <span className="wt-mono text-[11px] capitalize px-2 py-0.5 rounded-full" style={{ color: 'var(--wt-text-subtle)', background: 'var(--wt-surface-3)' }}>
                      {enc.type}
                    </span>
                    {/* Enclosure reorder buttons */}
                    <div className="flex gap-0.5 ml-1">
                      <button
                        onClick={() => moveEnclosure(encIdx, -1)}
                        disabled={encIdx === 0}
                        className="p-0.5 rounded transition-colors"
                        style={{ color: encIdx === 0 ? 'var(--wt-text-faint)' : 'var(--wt-text-subtle)', cursor: encIdx === 0 ? 'not-allowed' : undefined }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        onClick={() => moveEnclosure(encIdx, 1)}
                        disabled={encIdx === enclosures.length - 1}
                        className="p-0.5 rounded transition-colors"
                        style={{ color: encIdx === enclosures.length - 1 ? 'var(--wt-text-faint)' : 'var(--wt-text-subtle)', cursor: encIdx === enclosures.length - 1 ? 'not-allowed' : undefined }}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Arrays */}
                  {!isCollapsed && (
                    <div className="p-4 flex flex-col gap-6">
                      {enc.arrays.map((arr, arrIdx) => (
                        <BayGrid
                          key={arr.id}
                          array={arr}
                          bays={baysMap[arr.id] || []}
                          driveMap={driveMap}
                          profileMap={profileMap}
                          selectedBayId={selectedBay?.id}
                          highlightVdev={highlightVdev}
                          onMoveUp={arrIdx > 0 ? () => moveArray(enc, arrIdx, -1) : undefined}
                          onMoveDown={arrIdx < enc.arrays.length - 1 ? () => moveArray(enc, arrIdx, 1) : undefined}
                          onBayClick={bay => {
                            setSelectedBay(bay)
                            setSelectedDriveSerial(null)
                            const drive = driveMap[bay.drive_serial] || null
                            const profile = drive ? profileMap[drive.serial] : null
                            setBayModal({ bay, drive, profile, arrayName: arr.name })
                          }}
                          onBayHover={bay => setHoveredBay(bay)}
                          onBayHoverEnd={() => setHoveredBay(null)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {poolTopology.length > 0 && (
              <PoolTopologyPanel
                poolTopology={poolTopology}
                poolStats={poolStats}
                driveMap={driveMap}
                onDriveSelect={handleDriveSelect}
              />
            )}

            {federationData.length > 0 && (
              <div className="wt-card overflow-hidden">
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
                  style={{ borderBottom: '1px solid var(--wt-border)', background: 'var(--wt-surface-2)' }}
                  onClick={() => setCollapsedFederation(v => !v)}
                >
                  <span style={{ color: 'var(--wt-text-faint)' }}>
                    {collapsedFederation ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </span>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--wt-brand-50)' }}>
                    <Server size={13} style={{ color: 'var(--wt-brand-500)' }} />
                  </div>
                  <h2 className="font-semibold text-sm flex-1" style={{ color: 'var(--wt-text)' }}>Remote Instances</h2>
                  <span className="wt-mono text-[11px] px-2 py-0.5 rounded-full" style={{ color: 'var(--wt-text-subtle)', background: 'var(--wt-surface-3)' }}>
                    {federationData.length} {federationData.length === 1 ? 'instance' : 'instances'}
                  </span>
                </div>

                {!collapsedFederation && (
                  <div className="p-4 flex flex-col gap-4">
                    {federationData.map(snapshot => {
                      const isCollapsed = collapsedRemotes[snapshot.target_id] ?? false
                      return (
                        <div key={snapshot.target_id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--wt-border)' }}>
                          <div
                            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                            style={{ background: 'var(--wt-surface-2)' }}
                            onClick={() => setCollapsedRemotes(prev => ({ ...prev, [snapshot.target_id]: !prev[snapshot.target_id] }))}
                          >
                            <span style={{ color: 'var(--wt-text-faint)' }}>
                              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                            </span>
                            <span className="font-medium text-sm flex-1" style={{ color: 'var(--wt-text)' }}>{snapshot.target_name}</span>
                            <span className="wt-mono text-[10px] truncate max-w-[160px]" style={{ color: 'var(--wt-text-faint)' }}>{snapshot.target_url}</span>
                            <span className="wt-mono text-[11px] shrink-0" style={{ color: 'var(--wt-text-faint)' }}>
                              {snapshot.drives.length} drives
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); toggleRemoteView(snapshot.target_id) }}
                              className="p-1 rounded transition-colors"
                              style={{ color: 'var(--wt-text-faint)' }}
                              title={getRemoteView(snapshot.target_id) === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                            >
                              {getRemoteView(snapshot.target_id) === 'grid' ? <List size={13} /> : <LayoutGrid size={13} />}
                            </button>
                          </div>

                          {!isCollapsed && (
                            <div>
                              {getRemoteView(snapshot.target_id) === 'grid' ? (
                                (() => {
                                  const snapDriveMap = Object.fromEntries(snapshot.drives.map(d => [d.serial, d]))
                                  const encMap = {}
                                  for (const bay of snapshot.bays) {
                                    const ek = bay.enclosure_name || 'Unknown'
                                    if (!encMap[ek]) encMap[ek] = {}
                                    const ak = bay.array_name || 'Unknown'
                                    if (!encMap[ek][ak]) encMap[ek][ak] = []
                                    encMap[ek][ak].push(bay)
                                  }
                                  if (Object.keys(encMap).length === 0) {
                                    return <p className="px-4 py-3 text-xs text-slate-400 dark:text-gray-600 italic">No bay data available</p>
                                  }
                                  return Object.entries(encMap).map(([encName, arrays]) => (
                                    <div key={encName} className="px-4 py-3">
                                      <p className="text-xs font-medium text-slate-500 dark:text-gray-500 mb-2">{encName}</p>
                                      {Object.entries(arrays).map(([arrName, bays]) => {
                                        const maxRow = Math.max(...bays.map(b => b.row))
                                        const maxCol = Math.max(...bays.map(b => b.col))
                                        const grid = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill(null))
                                        for (const bay of bays) grid[bay.row][bay.col] = bay
                                        return (
                                          <div key={arrName} className="mb-3">
                                            <p className="text-[10px] text-slate-400 dark:text-gray-600 mb-1.5">{arrName}</p>
                                            <div
                                              className="grid gap-2"
                                              style={{ gridTemplateColumns: `repeat(${maxCol + 1}, minmax(0, 1fr))` }}
                                            >
                                              {grid.flat().map((bay, i) => {
                                                if (!bay) return <div key={i} className="min-h-[180px]" />
                                                const drive = bay.drive_serial ? snapDriveMap[bay.drive_serial] : null
                                                const hasErrors = drive ? ((drive.reallocated_sectors ?? 0) > 0 || (drive.pending_sectors ?? 0) > 0 || (drive.uncorrectable_errors ?? 0) > 0) : false
                                                const smartOk = drive?.smart_status === 'PASSED' && !hasErrors
                                                const smartWarn = drive?.smart_status === 'PASSED' && hasErrors
                                                const smartFail = drive?.smart_status === 'FAILED'
                                                const BayIcon = drive ? getDriveIcon(drive.form_factor, drive.rpm) : null
                                                const iconColor = smartFail ? 'var(--wt-down-500)' : smartWarn ? 'var(--wt-warn-500)' : smartOk ? 'var(--wt-up-500)' : 'var(--wt-text-faint)'
                                                const serialColor = smartFail ? 'var(--wt-down-600)' : smartWarn ? 'var(--wt-warn-600)' : smartOk ? 'var(--wt-up-600)' : 'var(--wt-text-subtle)'
                                                const dotBg = smartFail ? 'var(--wt-down-500)' : smartWarn ? 'var(--wt-warn-500)' : smartOk ? 'var(--wt-up-500)' : 'var(--wt-n-400)'
                                                const cardStyle = !drive
                                                  ? { borderColor: 'var(--wt-border)', background: 'var(--wt-surface-2)', borderStyle: 'dashed', cursor: 'default' }
                                                  : smartFail
                                                  ? { background: 'linear-gradient(to bottom, var(--wt-down-50), var(--wt-surface))', borderColor: 'var(--wt-down-100)' }
                                                  : smartWarn
                                                  ? { background: 'linear-gradient(to bottom, var(--wt-warn-50), var(--wt-surface))', borderColor: 'var(--wt-warn-100)' }
                                                  : smartOk
                                                  ? { background: 'linear-gradient(to bottom, var(--wt-up-50), var(--wt-surface))', borderColor: 'var(--wt-up-100)' }
                                                  : { background: 'linear-gradient(to bottom, var(--wt-surface-2), var(--wt-surface))', borderColor: 'var(--wt-border)' }
                                                return (
                                                  <button
                                                    key={i}
                                                    disabled={!drive}
                                                    onClick={() => drive && setSelectedRemoteDrive({ drive, bayInfo: bay, instanceName: snapshot.target_name, targetId: snapshot.target_id })}
                                                    onMouseEnter={() => drive && setHoveredRemoteDrive({ drive, instanceName: snapshot.target_name })}
                                                    onMouseLeave={() => setHoveredRemoteDrive(null)}
                                                    style={cardStyle}
                                                    className="relative min-h-[180px] flex flex-col rounded-xl border select-none transition-all duration-150 overflow-hidden group text-left"
                                                  >
                                                    <span className="absolute top-1.5 left-2 wt-mono text-[9px] leading-none z-10" style={{ color: 'var(--wt-text-faint)' }}>
                                                      {bay.label || `${bay.row + 1}-${bay.col + 1}`}
                                                    </span>
                                                    {drive && (
                                                      <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm z-10" style={{ background: dotBg }} />
                                                    )}
                                                    {!drive ? (
                                                      <div className="flex-1 flex items-center justify-center">
                                                        <span className="text-3xl" style={{ color: 'var(--wt-text-faint)' }}>·</span>
                                                      </div>
                                                    ) : (
                                                      <div className="flex-1 flex flex-col gap-2 px-2.5 pt-7 pb-3">
                                                        <div className="flex items-center gap-2">
                                                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--wt-surface)', border: '1px solid var(--wt-border)' }}>
                                                            <BayIcon size={15} style={{ color: iconColor }} />
                                                          </div>
                                                          <div className="min-w-0">
                                                            <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: 'var(--wt-text)' }}>
                                                              {drive.make || 'Unknown'}
                                                            </p>
                                                            {drive.model && (
                                                              <p className="text-[11px] leading-none truncate" style={{ color: 'var(--wt-text-subtle)' }}>{drive.model}</p>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <span className="wt-mono text-[10px] leading-none truncate" style={{ color: serialColor }}>
                                                          {drive.serial}
                                                        </span>
                                                        {drive.zfs_pool && (
                                                          <div className="flex items-center gap-1.5">
                                                            <span className="wt-mono text-[10px] truncate flex-1" style={{ color: 'var(--wt-text-subtle)' }}>{drive.zfs_pool}</span>
                                                            {drive.vdev_name && (
                                                              <span className="wt-mono text-[10px] shrink-0" style={{ color: 'var(--wt-text-faint)' }}>{drive.vdev_name}</span>
                                                            )}
                                                          </div>
                                                        )}
                                                        {drive.temperature_c != null && (
                                                          <div>
                                                            <div className="flex items-center justify-between mb-1">
                                                              <span className="wt-eyebrow">Temp</span>
                                                              <span className="wt-mono text-[10px] font-bold" style={{ color:
                                                                drive.temperature_c >= 65 ? 'var(--wt-down-500)' :
                                                                drive.temperature_c >= 55 ? 'var(--wt-warn-500)' :
                                                                'var(--wt-teal-500)'
                                                              }}>
                                                                {drive.temperature_c}°C
                                                              </span>
                                                            </div>
                                                            <div className="wt-meter">
                                                              <div
                                                                className="wt-meter__fill wt-meter__fill--temp"
                                                                style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
                                                              />
                                                            </div>
                                                          </div>
                                                        )}
                                                        <div className="flex items-center justify-between gap-1 mt-auto">
                                                          {drive.capacity_bytes && (
                                                            <span className="text-[10px]" style={{ color: 'var(--wt-text-muted)' }}>
                                                              {drive.capacity_bytes >= 1e12 ? `${(drive.capacity_bytes / 1e12).toFixed(1)} TB` : `${(drive.capacity_bytes / 1e9).toFixed(0)} GB`}
                                                            </span>
                                                          )}
                                                          {drive.device_path && (
                                                            <span className="wt-mono text-[10px] truncate" style={{ color: 'var(--wt-text-faint)' }}>{drive.device_path}</span>
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </button>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ))
                                })()
                              ) : (
                                <div className="divide-y" style={{ borderColor: 'var(--wt-border)' }}>
                                  {snapshot.drives.length === 0 && (
                                    <p className="px-4 py-3 text-xs italic" style={{ color: 'var(--wt-text-faint)' }}>No drives reported</p>
                                  )}
                                  {(() => {
                                    const bayBySerial = Object.fromEntries(
                                      snapshot.bays.filter(b => b.drive_serial).map(b => [b.drive_serial, b])
                                    )
                                    return snapshot.drives.map(d => {
                                      const smartOk = d.smart_status === 'PASSED'
                                      const smartFail = d.smart_status === 'FAILED'
                                      const bayInfo = bayBySerial[d.serial] || null
                                      const bayLabel = bayInfo
                                        ? [bayInfo.enclosure_name, bayInfo.array_name, bayInfo.label || `R${(bayInfo.row ?? 0) + 1}S${(bayInfo.col ?? 0) + 1}`].filter(Boolean).join(' › ')
                                        : null
                                      return (
                                        <button
                                          key={d.serial}
                                          onClick={() => setSelectedRemoteDrive({ drive: d, bayInfo, instanceName: snapshot.target_name, targetId: snapshot.target_id })}
                                          onMouseEnter={() => setHoveredRemoteDrive({ drive: d, instanceName: snapshot.target_name })}
                                          onMouseLeave={() => setHoveredRemoteDrive(null)}
                                          className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left hover:bg-[var(--wt-surface-2)]"
                                        >
                                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: smartOk ? 'var(--wt-up-500)' : smartFail ? 'var(--wt-down-500)' : 'var(--wt-n-400)' }} />
                                          <div className="flex-1 min-w-0">
                                            <p className="wt-mono text-xs truncate" style={{ color: 'var(--wt-text)' }}>{d.serial}</p>
                                            <p className="text-xs truncate" style={{ color: 'var(--wt-text-faint)' }}>{[d.make, d.model].filter(Boolean).join(' ') || 'Unknown'}</p>
                                          </div>
                                          <div className="flex items-center gap-3 text-xs shrink-0" style={{ color: 'var(--wt-text-subtle)' }}>
                                            {bayLabel && <span className="truncate max-w-[120px]" style={{ color: 'var(--wt-text-faint)' }}>{bayLabel}</span>}
                                            {d.temperature_c != null && (
                                              <span className="wt-mono" style={{ color: d.temperature_c >= 55 ? 'var(--wt-down-500)' : d.temperature_c >= 45 ? 'var(--wt-warn-500)' : undefined }}>
                                                {d.temperature_c}°C
                                              </span>
                                            )}
                                            {d.zfs_pool && <span className="wt-mono" style={{ color: 'var(--wt-brand-500)' }}>{d.zfs_pool}</span>}
                                          </div>
                                        </button>
                                      )
                                    })
                                  })()}
                                </div>
                              )}
                              <p className="wt-mono px-4 py-1.5 text-[10px]" style={{ color: 'var(--wt-text-faint)', borderTop: '1px solid var(--wt-border)' }}>
                                Synced {snapshot.fetched_at ? new Date(snapshot.fetched_at).toLocaleString() : '—'}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          </>}
          {activeView === 'drives' && <DrivesPage drives={drives} profiles={profiles} enclosures={enclosures} baysMap={baysMap} onSaved={loadAll} />}
          {activeView === 'reports' && <Reports />}
        </div>

        {selectedRemoteDrive && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedRemoteDrive(null)} />
            <div className="flex min-h-full items-start justify-center p-4 pt-16">
              <div className="relative w-full max-w-md">
                <DriveCard
                  drive={selectedRemoteDrive.drive}
                  remote
                  instanceName={selectedRemoteDrive.instanceName}
                  remoteHistory={remoteHistory?.history ?? null}
                  remoteHistoryError={remoteHistory?.error ?? null}
                  onClose={() => setSelectedRemoteDrive(null)}
                />
              </div>
            </div>
          </div>
        )}

        {bayModal && (
          <BayModal
            bay={bayModal.bay}
            drive={bayModal.drive}
            profile={bayModal.profile}
            drives={drives}
            arrayName={bayModal.arrayName}
            onClose={() => { setBayModal(null); setSelectedBay(null) }}
            onSaved={() => { setBayModal(null); loadAll() }}
            drivePanel={bayModal.drive ? (
              <DriveCard
                drive={bayModal.drive}
                profile={bayModal.profile}
                bay={bayModal.bay}
                poolStats={poolStats}
              />
            ) : undefined}
          />
        )}

        <SettingsModal open={settingsOpen} onClose={onCloseSettings} onUpdate={loadAll} />
      </div>

      <DragOverlay>
        {activeDrive && (
          <div className="wt-btn wt-btn--primary pointer-events-none shadow-[var(--wt-shadow-md)]">
            <HardDrive size={12} />
            <span className="wt-mono">{(activeDrive.model || activeDriveSerial).slice(0, 24)}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
