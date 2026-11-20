// Fleet model — pure functions that turn raw API data into what the screens render.
// Kept free of React so it can be unit-tested (see fleet.test.js).
//
// BayWatch status vocabulary → the four Watchtower states:
//   Healthy  → up    (SMART passed, no error counters)
//   Degraded → warn  (SMART passed but reallocated/pending/uncorrectable/ZFS errors)
//   Failing  → down  (SMART failed, or heavy ZFS errors)
//   Unknown  → muted (no SMART data, or the drive is disconnected)

import { healthState } from './health'
import { driveName, fmtCap, plural } from './format'

export const STATUS_LABEL = { up: 'Healthy', warn: 'Degraded', down: 'Failing', muted: 'Unknown' }

/** Health of a drive as one of the four shared states. Disconnected drives are muted. */
export function driveStatus(drive) {
  if (!drive) return 'muted'
  if (drive.is_connected === false) return 'muted'
  const s = healthState(drive)
  return s === 'ok' ? 'up' : s === 'warn' ? 'warn' : s === 'failed' ? 'down' : 'muted'
}

export function driveStatusLabel(drive) {
  if (drive?.is_connected === false) return 'Offline'
  return STATUS_LABEL[driveStatus(drive)]
}

export function hasErrorCounters(d) {
  return (d.reallocated_sectors ?? 0) > 0 || (d.pending_sectors ?? 0) > 0 ||
    (d.uncorrectable_errors ?? 0) > 0 || (d.zfs_checksum_errors ?? 0) > 0 ||
    (d.zfs_read_errors ?? 0) > 0 || (d.zfs_write_errors ?? 0) > 0
}

// ── Temperature ────────────────────────────────────────────────────────────
// Bands follow the user's configured alert thresholds (Settings → Notifications),
// so a drive only turns amber/red when it would actually alert.

export const TEMP_COLOR = {
  cool: 'var(--wt-teal-500)',
  normal: 'var(--wt-up-500)',
  warn: 'var(--wt-warn-500)',
  down: 'var(--wt-down-500)',
}

export function tempBand(t, { warnC = 55, dangerC = 60 } = {}) {
  if (t == null) return null
  if (t >= dangerC) return 'down'
  if (t >= warnC) return 'warn'
  if (t <= warnC - 25) return 'cool'
  return 'normal'
}

export function tempLegend({ warnC = 55, dangerC = 60 } = {}) {
  return [
    { color: TEMP_COLOR.cool, label: `${warnC - 25}°C or less` },
    { color: TEMP_COLOR.normal, label: `${warnC - 24} to ${warnC - 1}°C` },
    { color: TEMP_COLOR.warn, label: `${warnC} to ${dangerC - 1}°C` },
    { color: TEMP_COLOR.down, label: `${dangerC}°C or more` },
  ]
}

// ── Bays ───────────────────────────────────────────────────────────────────

export function bayLabel(bay) {
  if (!bay) return ''
  return bay.label || `${bay.row + 1}-${bay.col + 1}`
}

/** 'damaged' | 'empty' | 'live' */
export function bayState(bay, drive) {
  if (bay?.status === 'damaged') return 'damaged'
  if (!drive) return 'empty'
  return 'live'
}

export function isSpare(drive, bay) {
  return bay?.status === 'hot_spare' || bay?.status === 'cold_spare' || /^spare/i.test(drive?.vdev_name || '')
}

// ── Pool groups ────────────────────────────────────────────────────────────
// Categorical viz ramp, ordered so the first series avoid the status hues.
const GROUP_VIZ = ['--wt-viz-1', '--wt-viz-5', '--wt-viz-2', '--wt-viz-6', '--wt-viz-3', '--wt-viz-7', '--wt-viz-4']
export const SPARE_COLOR = 'var(--wt-n-500)'
export const NO_GROUP_COLOR = 'var(--wt-n-300)'

/** Group key for a drive: its vdev, 'spare', or null when it isn't in a pool. */
export function poolGroupKey(drive, bay) {
  if (isSpare(drive, bay)) return 'spare'
  return drive?.vdev_name || drive?.zfs_pool || null
}

/** Stable group → colour map for a set of drives. */
export function poolGroups(drives, bayBySerial = {}) {
  const keys = new Set()
  let spares = 0
  const counts = {}
  for (const d of drives) {
    const k = poolGroupKey(d, bayBySerial[d.serial])
    if (!k) continue
    if (k === 'spare') { spares++; continue }
    keys.add(k)
    counts[k] = (counts[k] || 0) + 1
  }
  // vdevs (raidz1-1, mirror-0…) take the first colours; whole-pool keys like boot-pool come after.
  const vdevs = new Set(drives.map(d => d.vdev_name).filter(Boolean))
  const sorted = [...keys].sort((a, b) => (vdevs.has(b) - vdevs.has(a)) || a.localeCompare(b, undefined, { numeric: true }))
  const groups = sorted.map((key, i) => ({
    key, label: key, count: counts[key], color: `var(${GROUP_VIZ[i % GROUP_VIZ.length]})`,
  }))
  if (spares) groups.push({ key: 'spare', label: 'Spare', count: spares, color: SPARE_COLOR })
  return groups
}

export function groupColor(groups, key) {
  if (!key) return NO_GROUP_COLOR
  return groups.find(g => g.key === key)?.color ?? NO_GROUP_COLOR
}

// ── Locations ──────────────────────────────────────────────────────────────

export const GROUP_TYPE_LABEL = {
  zfs_pool: 'ZFS pool', zfs_mirror: 'ZFS mirror', zfs_raidz1: 'ZFS RAIDZ1', zfs_raidz2: 'ZFS RAIDZ2',
  hardware_raid: 'HW RAID', pcie_slots: 'PCIe slots', standalone: 'Standalone', other: 'Other',
}

function locationKind(enclosureType) {
  return enclosureType === 'jbod' ? 'shelf' : enclosureType === 'server' ? 'server' : 'other'
}
const KIND_LABEL = { server: 'Server', shelf: 'Shelf', other: 'Enclosure', remote: 'Remote' }

function summarize(arrays, driveMap) {
  let bayCount = 0, populated = 0, connected = 0
  for (const { bays } of arrays) {
    for (const b of bays) {
      bayCount++
      const d = b.drive_serial ? driveMap[b.drive_serial] : null
      if (d) { populated++; if (d.is_connected !== false) connected++ }
    }
  }
  return { bayCount, populated, connected, offline: populated > 0 && connected === 0 }
}

/**
 * Every place a drive can live: local enclosures first, then federated (remote) instances.
 * Shape: { id, kind, name, sub, remote, offline, arrays: [{ array, bays }], driveMap, bayCount, populated }
 */
export function buildLocations({ enclosures = [], baysMap = {}, driveMap = {}, federation = [] }) {
  const local = enclosures.map(enc => {
    const arrays = [...(enc.arrays || [])]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map(array => ({ array, bays: baysMap[array.id] || [] }))
    const s = summarize(arrays, driveMap)
    const kind = locationKind(enc.type)
    return {
      id: `enc-${enc.id}`, kind, name: enc.name, remote: false, enclosure: enc, arrays, driveMap, ...s,
      sub: `${KIND_LABEL[kind]}, ${plural(s.populated, 'drive')}`,
    }
  })

  const remote = federation.map(snap => {
    const dm = Object.fromEntries((snap.drives || []).map(d => [d.serial, d]))
    const byArray = new Map()
    for (const bay of snap.bays || []) {
      const key = `${bay.enclosure_name || 'Unknown'} › ${bay.array_name || 'Bays'}`
      if (!byArray.has(key)) byArray.set(key, [])
      byArray.get(key).push(bay)
    }
    const arrays = [...byArray.entries()].map(([name, bays], i) => ({
      array: {
        id: `r${snap.target_id}-${i}`, name,
        rows: Math.max(...bays.map(b => b.row)) + 1,
        cols: Math.max(...bays.map(b => b.col)) + 1,
        group_type: 'drive_bays',
      },
      bays,
    }))
    const s = summarize(arrays, dm)
    return {
      id: `fed-${snap.target_id}`, kind: 'remote', name: snap.target_name, remote: true,
      targetId: snap.target_id, url: snap.target_url, fetchedAt: snap.fetched_at,
      pools: snap.pools || [], arrays, driveMap: dm, ...s,
      sub: `Remote, ${plural((snap.drives || []).length, 'drive')}`,
    }
  })

  return [...local, ...remote]
}

/** serial → { location, array, bay } for local drives. */
export function placementIndex(locations) {
  const idx = {}
  for (const loc of locations) {
    if (loc.remote) continue
    for (const { array, bays } of loc.arrays) {
      for (const bay of bays) {
        if (bay.drive_serial) idx[bay.drive_serial] = { location: loc, array, bay }
      }
    }
  }
  return idx
}

export function placementLabel(p) {
  if (!p) return null
  return `${p.location.name} · ${bayLabel(p.bay)}`
}

// ── Needs attention ────────────────────────────────────────────────────────

/**
 * Ordered list of things a human should look at. Empty → "all clear".
 * Each: { id, tone: 'down'|'warn'|'muted', title, detail, to }
 */
export function attentionItems({ drives = [], locations = [], thresholds = {} }) {
  const items = []
  const local = locations.filter(l => !l.remote)

  const damaged = []
  for (const loc of local) for (const { bays } of loc.arrays) for (const b of bays) {
    if (b.status === 'damaged') damaged.push({ loc, bay: b })
  }
  if (damaged.length) {
    const multiLoc = new Set(damaged.map(x => x.loc.id)).size > 1
    items.push({
      id: 'damaged', tone: 'down',
      title: `${plural(damaged.length, 'bay')} marked damaged`,
      detail: listJoin(damaged.map(x => (multiLoc ? `${x.loc.name} ${bayLabel(x.bay)}` : bayLabel(x.bay)))),
      to: { kind: 'bay', locationId: damaged[0].loc.id },
    })
  }

  const connected = drives.filter(d => d.is_connected !== false)
  const failing = connected.filter(d => driveStatus(d) === 'down')
  if (failing.length) {
    items.push({
      id: 'failing', tone: 'down', urgent: true,
      title: `${plural(failing.length, 'drive')} failing`,
      detail: listJoin(failing.map(driveName)),
      to: { kind: 'drives', filter: 'failed' },
    })
  }

  const degraded = connected.filter(d => driveStatus(d) === 'warn')
  if (degraded.length) {
    items.push({
      id: 'errors', tone: 'warn',
      title: `${plural(degraded.length, 'drive')} reporting errors`,
      detail: 'See SMART events in Reports',
      to: { kind: 'reports', tab: 'smart' },
    })
  }

  const realloc = drives.reduce((s, d) => s + (d.reallocated_sectors || 0), 0)
  if (realloc > 0) {
    const n = drives.filter(d => (d.reallocated_sectors || 0) > 0).length
    items.push({
      id: 'realloc', tone: 'warn',
      title: `${plural(realloc, 'reallocated sector')}`,
      detail: n === 1 ? 'On 1 drive' : `Across ${n} drives`,
      to: { kind: 'drives', filter: 'errors' },
    })
  }

  const { warnC = 55 } = thresholds
  const hot = connected.filter(d => d.temperature_c != null && d.temperature_c >= warnC)
  if (hot.length) {
    const hottest = Math.max(...hot.map(d => d.temperature_c))
    items.push({
      id: 'hot', tone: hot.some(d => tempBand(d.temperature_c, thresholds) === 'down') ? 'down' : 'warn',
      urgent: hot.some(d => tempBand(d.temperature_c, thresholds) === 'down'),
      title: `${plural(hot.length, 'drive')} running hot`,
      detail: `Hottest at ${hottest}°C`,
      to: { kind: 'colorBy', value: 'temp' },
    })
  }

  const offline = drives.filter(d => d.is_connected === false)
  if (offline.length) {
    const where = new Set()
    for (const loc of local) for (const { bays } of loc.arrays) for (const b of bays) {
      if (b.drive_serial && offline.some(d => d.serial === b.drive_serial)) where.add(loc.name)
    }
    items.push({
      id: 'offline', tone: 'muted',
      title: `${plural(offline.length, 'drive')} disconnected`,
      detail: where.size ? listJoin([...where]) : 'Not placed in a bay',
      to: { kind: 'drives', filter: 'disconnected' },
    })
  }

  return items
}

function listJoin(xs, max = 4) {
  const shown = xs.slice(0, max)
  const rest = xs.length - shown.length
  if (shown.length === 1) return shown[0]
  const body = shown.length === 2 && !rest ? `${shown[0]} and ${shown[1]}` : shown.join(', ')
  return rest > 0 ? `${body} and ${rest} more` : body
}

// ── Fleet summary + hero gauge ─────────────────────────────────────────────

const STATUS_ORDER = { up: 0, warn: 1, down: 2, muted: 3 }

export function fleetSummary(drives = []) {
  const counts = { up: 0, warn: 0, down: 0, muted: 0, offline: 0 }
  for (const d of drives) {
    if (d.is_connected === false) counts.offline++
    counts[driveStatus(d)]++
  }
  const total = drives.length
  const passed = drives.filter(d => d.smart_status === 'PASSED').length
  return { total, passed, pct: total ? Math.round((passed / total) * 100) : 0, ...counts }
}

/** One arc segment per drive, healthiest first. */
export function gaugeSegments(drives = [], { cx = 200, cy = 190, rOuter = 172, rInner = 128, gap = 0.014 } = {}) {
  const sorted = [...drives].sort((a, b) => STATUS_ORDER[driveStatus(a)] - STATUS_ORDER[driveStatus(b)])
  const n = sorted.length
  if (!n) return []
  const step = Math.PI / n
  const g = Math.min(gap, step / 4)
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  return sorted.map((d, i) => {
    const a0 = Math.PI + i * step + g
    const a1 = Math.PI + (i + 1) * step - g
    const path = `M${p(rOuter, a0)} A${rOuter} ${rOuter} 0 0 1 ${p(rOuter, a1)} L${p(rInner, a1)} A${rInner} ${rInner} 0 0 0 ${p(rInner, a0)} Z`
    return { serial: d.serial, status: driveStatus(d), d: path }
  })
}

export function heroCopy({ summary, attention, primaryName }) {
  const { total, up } = summary
  if (!total) {
    return { title: 'No drives yet', sub: 'Run a scan to discover the drives in this machine.' }
  }
  if (!attention.length) {
    return { title: 'Everything is running smoothly', sub: `All ${plural(total, 'drive')} are healthy and nothing needs attention.` }
  }
  const healthy = `${up} of ${plural(total, 'drive')} ${up === 1 ? 'is' : 'are'} healthy.`
  const need = `${plural(attention.length, 'item')} ${attention.length === 1 ? 'needs' : 'need'} a look.`
  if (attention.some(a => a.urgent)) {
    return { title: 'Something needs you now', sub: `${healthy} ${need}` }
  }
  return { title: `${primaryName || 'Your fleet'} is running well`, sub: `${healthy} ${need}` }
}

// ── Temperature spread ─────────────────────────────────────────────────────

/** Histogram of connected drive temperatures. Bins are 1°C, widened when the range is large. */
export function tempSpread(drives = [], labelFor = d => d.serial) {
  const withT = drives.filter(d => d.is_connected !== false && d.temperature_c != null)
  if (!withT.length) return { bins: [], avg: null, binSize: 1 }
  const temps = withT.map(d => d.temperature_c)
  const min = Math.min(...temps), max = Math.max(...temps)
  const binSize = max - min > 18 ? Math.ceil((max - min + 1) / 14) : 1
  const start = min - ((min % binSize) + binSize) % binSize
  const bins = []
  for (let t = start; t <= max; t += binSize) bins.push({ t, tMax: t + binSize - 1, count: 0, labels: [] })
  for (const d of withT) {
    const b = bins[Math.floor((d.temperature_c - start) / binSize)]
    b.count++
    b.labels.push(labelFor(d))
  }
  const avg = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
  return { bins, avg, binSize }
}

// ── Drive history helpers ──────────────────────────────────────────────────

/** Sum of positive deltas in a cumulative counter (tolerates counter resets). */
export function counterDelta(history = [], key) {
  let total = 0, prev = null, seen = false
  for (const h of history) {
    const v = h[key]
    if (v == null) continue
    if (prev != null) total += v >= prev ? v - prev : v
    prev = v
    seen = true
  }
  return seen && history.filter(h => h[key] != null).length > 1 ? total : null
}

export function tempTrend(history = []) {
  const t = history.map(h => h.temperature_c).filter(v => v != null)
  if (t.length < 3) return null
  const mean = t.reduce((a, b) => a + b, 0) / t.length
  const sd = Math.sqrt(t.reduce((a, b) => a + (b - mean) ** 2, 0) / t.length)
  const third = Math.max(1, Math.floor(t.length / 3))
  const first = t.slice(0, third).reduce((a, b) => a + b, 0) / third
  const last = t.slice(-third).reduce((a, b) => a + b, 0) / third
  if (last - first >= 3) return 'Rising'
  if (first - last >= 3) return 'Falling'
  return sd < 2 ? 'Steady' : 'Variable'
}

export function capLabel(d) {
  return fmtCap(d?.capacity_bytes)
}
