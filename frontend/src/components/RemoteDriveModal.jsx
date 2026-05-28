import { X, HardDrive, Server } from 'lucide-react'

function Row({ label, value, mono }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-gray-800/60 last:border-0">
      <span className="text-xs text-slate-500 dark:text-gray-500 shrink-0 w-36">{label}</span>
      <span className={`text-xs text-slate-800 dark:text-gray-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function fmtBytes(b) {
  if (b == null) return null
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)} TB`
  if (b >= 1e9)  return `${(b / 1e9).toFixed(0)} GB`
  return `${b} B`
}

function fmtHours(h) {
  if (h == null) return null
  const years = Math.floor(h / 8760)
  const days  = Math.floor((h % 8760) / 24)
  return years > 0 ? `${years}y ${days}d (${h.toLocaleString()} hrs)` : `${days}d (${h.toLocaleString()} hrs)`
}

export default function RemoteDriveModal({ drive, bayInfo, instanceName, onClose }) {
  if (!drive) return null

  const tempColor =
    drive.temperature_c >= 55 ? 'text-red-500' :
    drive.temperature_c >= 45 ? 'text-amber-500' :
    'text-slate-800 dark:text-gray-200'

  const smartColor =
    drive.smart_status === 'PASSED' ? 'text-emerald-600 dark:text-emerald-400' :
    drive.smart_status === 'FAILED' ? 'text-red-500 dark:text-red-400' :
    'text-slate-500 dark:text-gray-500'

  const bayLabel = bayInfo
    ? [bayInfo.enclosure_name, bayInfo.array_name, bayInfo.label || `Row ${(bayInfo.row ?? 0) + 1}, Slot ${(bayInfo.col ?? 0) + 1}`].filter(Boolean).join(' › ')
    : 'Unassigned'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                <HardDrive size={16} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Remote Drive</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-gray-500">
                  <Server size={10} />
                  <span>{instanceName}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">

            {/* Identity */}
            <section>
              <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">Identity</p>
              <Row label="Serial"       value={drive.serial}         mono />
              <Row label="Make"         value={drive.make} />
              <Row label="Model"        value={drive.model} />
              <Row label="Capacity"     value={fmtBytes(drive.capacity_bytes)} />
              <Row label="Form Factor"  value={drive.form_factor} />
              <Row label="Type"         value={drive.rpm === 0 ? 'SSD' : drive.rpm ? `HDD ${drive.rpm} rpm` : null} />
              <Row label="Firmware"     value={drive.firmware_version} mono />
              <Row label="Device Path"  value={drive.device_path}    mono />
            </section>

            {/* Health */}
            <section>
              <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">Health</p>
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-gray-800/60">
                <span className="text-xs text-slate-500 dark:text-gray-500 shrink-0 w-36">SMART Status</span>
                <span className={`text-xs font-medium ${smartColor}`}>{drive.smart_status || 'Unknown'}</span>
              </div>
              {drive.temperature_c != null && (
                <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-gray-800/60">
                  <span className="text-xs text-slate-500 dark:text-gray-500 shrink-0 w-36">Temperature</span>
                  <span className={`text-xs font-medium ${tempColor}`}>{drive.temperature_c}°C</span>
                </div>
              )}
              <Row label="Power-On Hours"       value={fmtHours(drive.power_on_hours)} />
              <Row label="Reallocated Sectors"  value={drive.reallocated_sectors != null ? String(drive.reallocated_sectors) : null} />
              <Row label="Pending Sectors"      value={drive.pending_sectors != null ? String(drive.pending_sectors) : null} />
              <Row label="Uncorrectable Errors" value={drive.uncorrectable_errors != null ? String(drive.uncorrectable_errors) : null} />
            </section>

            {/* Location */}
            <section>
              <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">Location</p>
              <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 dark:border-gray-800/60">
                <span className="text-xs text-slate-500 dark:text-gray-500 shrink-0 w-36">Bay</span>
                <span className="text-xs text-slate-800 dark:text-gray-200 text-right">{bayLabel}</span>
              </div>
              {drive.zfs_pool && (
                <div className="flex items-start justify-between gap-4 py-1.5">
                  <span className="text-xs text-slate-500 dark:text-gray-500 shrink-0 w-36">ZFS Pool</span>
                  <span className="text-xs font-mono text-blue-500 dark:text-blue-400">{drive.zfs_pool}</span>
                </div>
              )}
            </section>

            {drive.last_scanned && (
              <p className="text-[10px] text-slate-300 dark:text-gray-700 text-right">
                Last scanned {new Date(drive.last_scanned).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
