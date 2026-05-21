import { useEffect, useState, useCallback } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Server, HardDrive } from 'lucide-react'
import BayGrid from '../components/BayGrid'
import DriveCard from '../components/DriveCard'
import DriveList from '../components/DriveList'
import DriveEditModal from '../components/DriveEditModal'
import SettingsModal from '../components/SettingsModal'
import ScanButton from '../components/ScanButton'
import EmptyBayModal from '../components/EmptyBayModal'
import WidgetBar from '../components/WidgetBar'
import { getEnclosures, getDrives, getBays, getProfile, assignDrive } from '../api/client'

export default function Dashboard({ onOpenLog, onOpenSettings, settingsOpen, onCloseSettings }) {
  const [enclosures, setEnclosures] = useState([])
  const [drives, setDrives] = useState([])
  const [baysMap, setBaysMap] = useState({})
  const [profiles, setProfiles] = useState([])
  const [selectedBay, setSelectedBay] = useState(null)
  const [selectedDriveSerial, setSelectedDriveSerial] = useState(null)
  const [emptyBay, setEmptyBay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeDriveSerial, setActiveDriveSerial] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

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
      const [encs, drvs] = await Promise.all([getEnclosures(), getDrives()])
      setEnclosures(encs)
      setDrives(drvs)

      const allArrayIds = encs.flatMap(e => e.arrays.map(a => a.id))
      const bayResults = await Promise.all(allArrayIds.map(id => getBays(id)))
      const newBaysMap = {}
      allArrayIds.forEach((id, i) => { newBaysMap[id] = bayResults[i] })
      setBaysMap(newBaysMap)

      const profileResults = await Promise.allSettled(drvs.map(d => getProfile(d.serial)))
      setProfiles(profileResults.filter(r => r.status === 'fulfilled').map(r => r.value))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

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

  const activeDrive = activeDriveSerial ? driveMap[activeDriveSerial] : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400 dark:text-gray-600">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
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
      <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100vh-49px)]">
        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-gray-800/60">

          <WidgetBar drives={drives} profiles={profiles} baysMap={baysMap} />

          {/* Enclosure area */}
          <div className="flex-1 p-5 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-semibold text-slate-700 dark:text-gray-300 tracking-tight">
                {enclosures.length > 0 ? 'Enclosures' : 'Getting Started'}
              </h1>
              <ScanButton onScanComplete={loadAll} onOpenLog={onOpenLog} />
            </div>

            {enclosures.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-gray-700/60 bg-white dark:bg-gray-900/30 p-16 text-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-400/10 border border-blue-500/20 flex items-center justify-center">
                  <HardDrive size={26} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-semibold mb-1">No enclosures yet</p>
                  <p className="text-sm text-slate-500 dark:text-gray-500">
                    Go to{' '}
                    <button onClick={onOpenSettings} className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 underline underline-offset-2">
                      Settings
                    </button>{' '}
                    to add your first enclosure and bay array.
                  </p>
                </div>
              </div>
            )}

            {enclosures.map(enc => (
              <div
                key={enc.id}
                className="rounded-2xl bg-white dark:bg-gray-900/50 border border-slate-200 dark:border-gray-800/60 overflow-hidden"
              >
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-gray-800/60 bg-slate-50 dark:bg-gray-900/80">
                  <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                    <Server size={13} className="text-slate-500 dark:text-gray-400" />
                  </div>
                  <h2 className="font-semibold text-slate-800 dark:text-gray-200 text-sm">{enc.name}</h2>
                  <span className="text-xs text-slate-500 dark:text-gray-600 capitalize bg-slate-100 dark:bg-gray-800/60 px-2 py-0.5 rounded-full">
                    {enc.type}
                  </span>
                </div>
                <div className="p-4 flex flex-col gap-6">
                  {enc.arrays.map(arr => (
                    <BayGrid
                      key={arr.id}
                      array={arr}
                      bays={baysMap[arr.id] || []}
                      driveMap={driveMap}
                      selectedBayId={selectedBay?.id}
                      onBayClick={bay => {
                        if (!bay.drive_serial) {
                          setEmptyBay(bay)
                        } else {
                          setSelectedBay(bay)
                          setSelectedDriveSerial(null)
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {emptyBay && (
          <EmptyBayModal
            bay={emptyBay}
            drives={drives}
            onClose={() => setEmptyBay(null)}
            onCreated={() => { setEmptyBay(null); loadAll() }}
          />
        )}

        {editTarget && (
          <DriveEditModal
            drive={editTarget.drive}
            profile={editTarget.profile}
            onClose={() => setEditTarget(null)}
            onSaved={() => { setEditTarget(null); loadAll() }}
          />
        )}

        <SettingsModal open={settingsOpen} onClose={onCloseSettings} onUpdate={loadAll} />

        {/* Sidebar */}
        <div className="w-full lg:w-[340px] shrink-0 flex flex-col bg-white dark:bg-gray-950 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-gray-800">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-gray-800/60">
            <p className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase tracking-widest">
              {selectedDrive ? 'Drive Details' : 'All Drives'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedDrive ? (
              <DriveCard
                drive={selectedDrive}
                profile={selectedProfile}
                onEdit={() => setEditTarget({ drive: selectedDrive, profile: selectedProfile })}
                onClose={() => { setSelectedBay(null); setSelectedDriveSerial(null) }}
              />
            ) : (
              <DriveList
                drives={drives}
                profiles={profiles}
                selectedSerial={selectedDriveSerial}
                onSelect={serial => {
                  setSelectedDriveSerial(serial)
                  setSelectedBay(null)
                }}
                assignedSerials={assignedSerials}
              />
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDrive && (
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white shadow-lg pointer-events-none">
            <HardDrive size={12} />
            <span className="font-mono">{(activeDrive.model || activeDriveSerial).slice(0, 24)}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
