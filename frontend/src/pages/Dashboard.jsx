import { useEffect, useState, useCallback } from 'react'
import { Server } from 'lucide-react'
import BayGrid from '../components/BayGrid'
import DriveCard from '../components/DriveCard'
import DriveList from '../components/DriveList'
import ScanButton from '../components/ScanButton'
import { getEnclosures, getDrives, getBays, getProfile } from '../api/client'

export default function Dashboard() {
  const [enclosures, setEnclosures] = useState([])
  const [drives, setDrives] = useState([])
  const [baysMap, setBaysMap] = useState({})       // arrayId -> bay[]
  const [profiles, setProfiles] = useState([])
  const [selectedBay, setSelectedBay] = useState(null)
  const [selectedDriveSerial, setSelectedDriveSerial] = useState(null)
  const [loading, setLoading] = useState(true)

  const driveMap = Object.fromEntries(drives.map(d => [d.serial, d]))
  const profileMap = Object.fromEntries(profiles.map(p => [p.serial, p]))

  const loadAll = useCallback(async () => {
    try {
      const [encs, drvs] = await Promise.all([getEnclosures(), getDrives()])
      setEnclosures(encs)
      setDrives(drvs)

      // Load bays for every array across all enclosures
      const allArrayIds = encs.flatMap(e => e.arrays.map(a => a.id))
      const bayResults = await Promise.all(allArrayIds.map(id => getBays(id)))
      const newBaysMap = {}
      allArrayIds.forEach((id, i) => { newBaysMap[id] = bayResults[i] })
      setBaysMap(newBaysMap)

      // Load profiles for all drives
      const profileResults = await Promise.allSettled(drvs.map(d => getProfile(d.serial)))
      setProfiles(profileResults.filter(r => r.status === 'fulfilled').map(r => r.value))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const selectedDrive = selectedBay?.drive_serial
    ? driveMap[selectedBay.drive_serial]
    : selectedDriveSerial
    ? driveMap[selectedDriveSerial]
    : null

  const selectedProfile = selectedDrive ? profileMap[selectedDrive.serial] : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading drives…
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 lg:p-6 min-h-screen">
      {/* Main area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">Drive Position</h1>
          <ScanButton onScanComplete={loadAll} />
        </div>

        {enclosures.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500">
            No enclosures configured. Go to{' '}
            <a href="/settings" className="text-blue-400 hover:underline">Settings</a>{' '}
            to add your first enclosure.
          </div>
        )}

        {enclosures.map(enc => (
          <div key={enc.id} className="rounded-xl bg-gray-900 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Server size={18} className="text-gray-400" />
              <h2 className="font-semibold text-gray-200">{enc.name}</h2>
              <span className="text-xs text-gray-500 capitalize">({enc.type})</span>
            </div>
            <div className="flex flex-col gap-6">
              {enc.arrays.map(arr => (
                <BayGrid
                  key={arr.id}
                  array={arr}
                  bays={baysMap[arr.id] || []}
                  driveMap={driveMap}
                  selectedBayId={selectedBay?.id}
                  onBayClick={bay => {
                    setSelectedBay(bay)
                    setSelectedDriveSerial(null)
                  }}
                  onAssignmentChange={loadAll}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
        {selectedDrive ? (
          <DriveCard
            drive={selectedDrive}
            profile={selectedProfile}
            onClose={() => { setSelectedBay(null); setSelectedDriveSerial(null) }}
          />
        ) : (
          <div className="rounded-xl bg-gray-900 border border-gray-800 p-3">
            <p className="text-xs text-gray-500 mb-2 px-1">All Drives</p>
            <DriveList
              drives={drives}
              profiles={profiles}
              selectedSerial={selectedDriveSerial}
              onSelect={serial => {
                setSelectedDriveSerial(serial)
                setSelectedBay(null)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
