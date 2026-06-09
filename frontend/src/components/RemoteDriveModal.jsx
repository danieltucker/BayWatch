import { X, HardDrive, Server } from 'lucide-react'

function Row({ label, value, mono, color }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-4 py-1.5" style={{ borderBottom: '1px solid var(--wt-border)' }}>
      <span className="text-xs shrink-0 w-36" style={{ color: 'var(--wt-text-muted)' }}>{label}</span>
      <span className={`text-xs text-right ${mono ? 'wt-mono' : ''}`} style={{ color: color || 'var(--wt-text)' }}>{value}</span>
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
    drive.temperature_c >= 55 ? 'var(--wt-down-500)' :
    drive.temperature_c >= 45 ? 'var(--wt-warn-600)' :
    'var(--wt-text)'

  const smartColor =
    drive.smart_status === 'PASSED' ? 'var(--wt-up-600)' :
    drive.smart_status === 'FAILED' ? 'var(--wt-down-500)' :
    'var(--wt-text-muted)'

  const bayLabel = bayInfo
    ? [bayInfo.enclosure_name, bayInfo.array_name, bayInfo.label || `Row ${(bayInfo.row ?? 0) + 1}, Slot ${(bayInfo.col ?? 0) + 1}`].filter(Boolean).join(' › ')
    : 'Unassigned'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
          style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>

          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--wt-border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--wt-surface-2)' }}>
                <HardDrive size={16} style={{ color: 'var(--wt-brand-500)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>Remote Drive</p>
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--wt-text-muted)' }}>
                  <Server size={10} />
                  <span>{instanceName}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="transition-colors p-1 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">

            <section>
              <p className="wt-eyebrow mb-2">Identity</p>
              <Row label="Serial"       value={drive.serial}         mono />
              <Row label="Make"         value={drive.make} />
              <Row label="Model"        value={drive.model} />
              <Row label="Capacity"     value={fmtBytes(drive.capacity_bytes)} />
              <Row label="Form Factor"  value={drive.form_factor} />
              <Row label="Type"         value={drive.rpm === 0 ? 'SSD' : drive.rpm ? `HDD ${drive.rpm} rpm` : null} />
              <Row label="Firmware"     value={drive.firmware_version} mono />
              <Row label="Device Path"  value={drive.device_path}    mono />
            </section>

            <section>
              <p className="wt-eyebrow mb-2">Health</p>
              <div className="flex items-start justify-between gap-4 py-1.5" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                <span className="text-xs shrink-0 w-36" style={{ color: 'var(--wt-text-muted)' }}>SMART Status</span>
                <span className="wt-mono text-xs font-medium" style={{ color: smartColor }}>{drive.smart_status || 'Unknown'}</span>
              </div>
              {drive.temperature_c != null && (
                <div className="flex items-start justify-between gap-4 py-1.5" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                  <span className="text-xs shrink-0 w-36" style={{ color: 'var(--wt-text-muted)' }}>Temperature</span>
                  <span className="wt-mono text-xs font-medium" style={{ color: tempColor }}>{drive.temperature_c}°C</span>
                </div>
              )}
              <Row label="Power-On Hours"       value={fmtHours(drive.power_on_hours)} />
              <Row label="Reallocated Sectors"  value={drive.reallocated_sectors != null ? String(drive.reallocated_sectors) : null} />
              <Row label="Pending Sectors"      value={drive.pending_sectors != null ? String(drive.pending_sectors) : null} />
              <Row label="Uncorrectable Errors" value={drive.uncorrectable_errors != null ? String(drive.uncorrectable_errors) : null} />
            </section>

            <section>
              <p className="wt-eyebrow mb-2">Location</p>
              <div className="flex items-start justify-between gap-4 py-1.5" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                <span className="text-xs shrink-0 w-36" style={{ color: 'var(--wt-text-muted)' }}>Bay</span>
                <span className="text-xs text-right" style={{ color: 'var(--wt-text)' }}>{bayLabel}</span>
              </div>
              {drive.zfs_pool && (
                <div className="flex items-start justify-between gap-4 py-1.5">
                  <span className="text-xs shrink-0 w-36" style={{ color: 'var(--wt-text-muted)' }}>ZFS Pool</span>
                  <span className="wt-mono text-xs" style={{ color: 'var(--wt-brand-500)' }}>{drive.zfs_pool}</span>
                </div>
              )}
            </section>

            {drive.last_scanned && (
              <p className="wt-mono text-[10px] text-right" style={{ color: 'var(--wt-text-faint)' }}>
                Last scanned {new Date(drive.last_scanned).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
