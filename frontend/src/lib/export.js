// Drive inventory CSV export (moved from the old Dashboard; columns unchanged).

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function drivesToCSV(drives, profileMap = {}, placement = {}) {
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
    const loc = placement[d.serial]
    const cap = d.capacity_bytes
      ? d.capacity_bytes >= 1e12 ? `${(d.capacity_bytes / 1e12).toFixed(1)} TB` : `${(d.capacity_bytes / 1e9).toFixed(0)} GB`
      : ''
    return [
      d.serial, d.make, d.model, cap, d.form_factor, d.rpm, d.firmware_version,
      d.device_path, d.smart_status, d.temperature_c, d.power_on_hours,
      d.reallocated_sectors, d.pending_sectors, d.uncorrectable_errors,
      d.zfs_pool, d.vdev_name, d.last_scanned ? new Date(d.last_scanned).toISOString() : '',
      p.purchase_date, p.warranty_months, p.vendor, p.notes,
      loc?.location.name, loc?.array.name, loc ? (loc.bay.label || `R${loc.bay.row + 1}C${loc.bay.col + 1}`) : '',
    ].map(csvCell)
  })
  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

export function downloadText(text, filename, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportDrivesCSV(drives, profileMap, placement) {
  downloadText(drivesToCSV(drives, profileMap, placement), `baywatch-export-${new Date().toISOString().slice(0, 10)}.csv`)
}
