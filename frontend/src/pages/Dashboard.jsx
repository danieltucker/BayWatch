import { useEffect, useState, useCallback } from 'react'
import { Server, HardDrive, CheckCircle2, XCircle, Thermometer, ShieldAlert } from 'lucide-react'
import BayGrid from '../components/BayGrid'
import DriveCard from '../components/DriveCard'
import DriveList from '../components/DriveList'
import ScanButton from '../components/ScanButton'
import { getEnclosures, getDrives, getBays, getProfile } from '../api/client'

function StatCard({ icon: Icon, label, value, color = 'text-gray-300', sub }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-900/70 border border-gray-800/60 px-4 py-3 min-w-0">
      <div className={`shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 leading-none mb-0.5">{label}</p>
        <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [enclosures, setEnclosures] = useState([])
  const [drives, setDrives] = useState([])
  const [baysMap, setBaysMap] = useState({})
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

  // Stats
  const healthy = drives.filter(d => d.smart_status === 'PASSED').length
  const failed = drives.filter(d => d.smart_status === 'FAILED').length
  const temps = drives.map(d => d.temperature_c).filter(t => t != null)
  const avgTemp = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null
  const warrantyWarnings = profiles.filter(p => {
    const d = p.warranty_days_remaining
    return d != null && d <= 90
  }).length

  const selectedDrive = selectedBay?.drive_serial
    ? driveMap[selectedBay.drive_serial]
    : selectedDriveSerial
    ? driveMap[selectedDriveSerial]
    : null
  const selectedProfile = selectedDrive ? profileMap[selectedDrive.serial] : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-600">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        <span className="text-sm">Loading drives…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100vh-49px)]">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-gray-800/60">

        {/* Stats bar */}
        {drives.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800/60 overflow-x-auto">
            <StatCard icon={HardDrive} label="Total Drives" value={drives.length} color="text-gray-300" />
            <StatCard icon={CheckCircle2} label="Healthy" value={healthy} color="text-emerald-400" />
            {failed > 0 && (
              <StatCard icon={XCircle} label="Failed" value={failed} color="text-red-400" />
            )}
            {avgTemp != null && (
              <StatCard
                icon={Thermometer}
                label="Avg Temp"
                value={`${avgTemp}°C`}
                color={avgTemp >= 55 ? 'text-yellow-400' : 'text-sky-400'}
              />
            )}
            {warrantyWarnings > 0 && (
              <StatCard icon={ShieldAlert} label="Warranty" value={warrantyWarnings} color="text-amber-400" sub="expiring soon" />
            )}
          </div>
        )}

        {/* Enclosure area */}
        <div className="flex-1 p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-gray-300 tracking-tight">
              {enclosures.length > 0 ? 'Enclosures' : 'Getting Started'}
            </h1>
            <ScanButton onScanComplete={loadAll} />
          </div>

          {enclosures.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-700/60 bg-gray-900/30 p-16 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-400/10 border border-blue-500/20 flex items-center justify-center">
                <HardDrive size={26} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold mb-1">No enclosures yet</p>
                <p className="text-sm text-gray-500">
                  Go to{' '}
                  <a href="/settings" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                    Settings
                  </a>{' '}
                  to add your first enclosure and bay array.
                </p>
              </div>
            </div>
          )}

          {enclosures.map(enc => (
            <div
              key={enc.id}
              className="rounded-2xl bg-gray-900/50 border border-gray-800/60 overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-800/60 bg-gray-900/80">
                <div className="w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center">
                  <Server size={13} className="text-gray-400" />
                </div>
                <h2 className="font-semibold text-gray-200 text-sm">{enc.name}</h2>
                <span className="text-xs text-gray-600 capitalize bg-gray-800/60 px-2 py-0.5 rounded-full">
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
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-[340px] shrink-0 flex flex-col bg-gray-950">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">
            {selectedDrive ? 'Drive Details' : 'All Drives'}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {selectedDrive ? (
            <DriveCard
              drive={selectedDrive}
              profile={selectedProfile}
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
            />
          )}
        </div>
      </div>
    </div>
  )
}
