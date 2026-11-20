// Display formatters. Everything here returns strings meant to be rendered in mono.

export const DASH = '—'

export function fmtCap(bytes) {
  if (!bytes) return DASH
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  return `${Math.round(bytes / 1e9)} GB`
}

export function fmtTB(bytes, digits = 1) {
  if (bytes == null) return DASH
  return `${(bytes / 1e12).toFixed(digits)} TB`
}

/** Power-on hours → compact age: 6.9y · 5.9mo · 120h */
export function fmtAge(hours) {
  if (hours == null) return DASH
  if (hours >= 8760) return `${(hours / 8760).toFixed(1)}y`
  if (hours >= 720) return `${(hours / 730).toFixed(1)}mo`
  return `${hours}h`
}

/** Power-on hours → long age: 6.9 years · 5.9 months */
export function fmtAgeLong(hours) {
  if (hours == null) return DASH
  if (hours >= 8760) {
    const y = hours / 8760
    return `${y.toFixed(1)} ${y.toFixed(1) === '1.0' ? 'year' : 'years'}`
  }
  if (hours >= 720) return `${(hours / 730).toFixed(1)} months`
  return `${hours} hours`
}

export function fmtInt(n) {
  if (n == null) return DASH
  return Number(n).toLocaleString('en-US')
}

export function fmtTemp(t) {
  return t == null ? DASH : `${t}°C`
}

/** Bytes → "483 GB" or "1.2 TB" */
export function fmtIO(bytes) {
  if (bytes == null) return DASH
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  return `${Math.round(bytes / 1e9).toLocaleString('en-US')} GB`
}

export function fmtDate(value) {
  if (!value) return DASH
  // Date-only strings (YYYY-MM-DD) are parsed as local dates so they don't shift a day.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtShortDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtDateTime(value) {
  if (!value) return DASH
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function fmtRelative(date, now = Date.now()) {
  if (!date) return null
  const mins = Math.floor((now - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.floor(hrs / 24)
  return `${days} d ago`
}

export function driveName(d) {
  if (!d) return ''
  return [d.make, d.model].filter(Boolean).join(' ') || d.serial
}

export function driveKind(d) {
  if (!d) return DASH
  if (d.rpm === 0) {
    if (d.form_factor === 'M.2' || /nvme/i.test(d.device_path || '')) return 'NVMe SSD'
    return 'SSD'
  }
  if (d.rpm > 0) return `HDD ${d.rpm.toLocaleString('en-US')} rpm`
  return d.drive_type ? d.drive_type.replace(/_/g, ' ') : 'Drive'
}

export function formFactorLabel(ff) {
  if (!ff) return null
  return ff.replace(/"$/, ' in')
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
