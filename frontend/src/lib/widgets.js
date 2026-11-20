// Dashboard widgets. IDs are persisted (localStorage + /api/config/widgets), so never rename one.
// Each widget computes { value, rows: [[label, value]], note, tone } from the fleet context.

import { driveName, fmtAge, fmtAgeLong, fmtCap, fmtTB, plural } from './format'
import { bayLabel, tempBand } from './fleet'

// Order of the default set follows the design: the first one is the featured card.
export const DEFAULT_WIDGET_IDS = [
  'avg_temp', 'hottest_drive', 'oldest_drive', 'total_capacity', 'zfs_pools',
  'ssd_count', 'warranty_warnings', 'reallocated', 'health_pct',
]

const connected = drives => drives.filter(d => d.is_connected !== false)
const isSsd = d => d.rpm === 0
const where = (ctx, d) => {
  const p = ctx.placement?.[d.serial]
  return p ? `${p.location.name} ${bayLabel(p.bay)}` : 'Not in a bay'
}

export const WIDGETS = {
  total_drives: {
    label: 'Total drives',
    compute: (ctx) => {
      const rows = ctx.locations.filter(l => !l.remote).map(l => [l.name, String(l.populated)])
      const unplaced = ctx.drives.filter(d => !ctx.placement[d.serial]).length
      if (unplaced) rows.push(['Not in a bay', String(unplaced)])
      return { value: String(ctx.drives.length), rows, note: 'Includes drives that are currently disconnected.' }
    },
  },
  healthy: {
    label: 'Healthy',
    compute: ({ drives }) => {
      const passed = drives.filter(d => d.smart_status === 'PASSED').length
      const unknown = drives.filter(d => d.smart_status !== 'PASSED' && d.smart_status !== 'FAILED').length
      return { value: String(passed), rows: [['Passed SMART', String(passed)], ['Unknown', String(unknown)]], note: 'From the last scan.', tone: 'up' }
    },
  },
  failed: {
    label: 'Failed',
    compute: ({ drives }) => {
      const failed = drives.filter(d => d.smart_status === 'FAILED')
      return {
        value: String(failed.length),
        rows: failed.slice(0, 4).map(d => [driveName(d), d.serial]),
        note: failed.length ? 'Replace these drives as soon as possible.' : 'No drive is failing SMART.',
        tone: failed.length ? 'down' : null,
      }
    },
  },
  avg_temp: {
    label: 'Avg temp',
    spark: true,
    compute: (ctx) => {
      const live = connected(ctx.drives).filter(d => d.temperature_c != null)
      if (!live.length) return { value: '—', rows: [], note: 'No temperature readings yet.' }
      const avg = xs => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
      const rows = []
      for (const loc of ctx.locations.filter(l => !l.remote)) {
        for (const { array, bays } of loc.arrays) {
          const ts = bays.map(b => ctx.driveMap[b.drive_serial]).filter(d => d && d.is_connected !== false && d.temperature_c != null).map(d => d.temperature_c)
          if (ts.length) rows.push([array.name, `${avg(ts)}°C`])
        }
      }
      return { value: `${avg(live.map(d => d.temperature_c))}°C`, rows, note: 'Average across connected drives at the last scan.', tone: 'teal' }
    },
  },
  hottest_drive: {
    label: 'Hottest drive',
    compute: (ctx) => {
      const live = connected(ctx.drives).filter(d => d.temperature_c != null).sort((a, b) => b.temperature_c - a.temperature_c)
      if (!live.length) return { value: '—', rows: [], note: 'No temperature readings yet.' }
      const band = tempBand(live[0].temperature_c, ctx.thresholds)
      return {
        value: `${live[0].temperature_c}°C`,
        rows: live.slice(0, 3).map(d => [`${where(ctx, d)} · ${driveName(d)}`, `${d.temperature_c}°C`]),
        note: 'The three warmest drives at the last scan.',
        tone: band === 'down' ? 'down' : band === 'warn' ? 'warn' : null,
      }
    },
  },
  oldest_drive: {
    label: 'Oldest drive',
    compute: (ctx) => {
      const w = ctx.drives.filter(d => d.power_on_hours != null)
      if (!w.length) return { value: '—', rows: [], note: 'No power-on data yet.' }
      const old = w.reduce((a, b) => (b.power_on_hours > a.power_on_hours ? b : a))
      return {
        value: fmtAge(old.power_on_hours),
        rows: [['Drive', driveName(old)], ['Serial', old.serial], ['Bay', where(ctx, old)], ['Power-on', fmtAgeLong(old.power_on_hours)]],
        note: 'By power-on time.',
      }
    },
  },
  total_capacity: {
    label: 'Total capacity',
    compute: (ctx) => {
      const total = ctx.drives.reduce((s, d) => s + (d.capacity_bytes || 0), 0)
      const rows = (ctx.pools || []).map(p => [`${p.name} used`, `${fmtTB(p.alloc_bytes)} of ${fmtTB(p.size_bytes)} (${p.capacity_pct}%)`])
      return { value: total ? fmtCap(total) : '—', rows, note: 'Raw capacity of all drives.' }
    },
  },
  assigned_bays: {
    label: 'Assigned bays',
    compute: (ctx) => {
      const local = ctx.locations.filter(l => !l.remote)
      const rows = local.map(l => [l.name, `${l.populated}/${l.bayCount}`])
      const n = local.reduce((s, l) => s + l.populated, 0)
      const all = local.reduce((s, l) => s + l.bayCount, 0)
      return { value: `${n}/${all}`, rows, note: 'Bays with a drive in them.' }
    },
  },
  health_pct: {
    label: 'Drive health',
    compute: ({ drives }) => {
      if (!drives.length) return { value: '—', rows: [], note: '' }
      const passed = drives.filter(d => d.smart_status === 'PASSED').length
      const pct = Math.round((passed / drives.length) * 100)
      return {
        value: `${pct}%`, rows: [['Passed SMART', `${passed} of ${drives.length}`]],
        note: 'Share of drives passing SMART.', tone: pct === 100 ? 'up' : null,
      }
    },
  },
  reallocated: {
    label: 'Reallocated',
    compute: ({ drives }) => {
      const affected = drives.filter(d => (d.reallocated_sectors || 0) > 0).sort((a, b) => b.reallocated_sectors - a.reallocated_sectors)
      const total = affected.reduce((s, d) => s + d.reallocated_sectors, 0)
      const rows = [['Fleet total', plural(total, 'sector')], ...affected.slice(0, 3).map(d => [driveName(d), String(d.reallocated_sectors)])]
      return { value: String(total), rows, note: 'Open Reports to see SMART events.', tone: total ? 'warn' : null }
    },
  },
  ssd_count: {
    label: 'SSDs',
    compute: ({ drives }) => {
      const ssds = drives.filter(isSsd)
      return {
        value: String(ssds.length),
        rows: ssds.slice(0, 4).map(d => [driveName(d), [fmtCap(d.capacity_bytes), d.temperature_c != null ? `${d.temperature_c}°C` : null].filter(Boolean).join(', ')]),
        note: 'Solid-state drives.',
      }
    },
  },
  hdd_count: {
    label: 'HDDs',
    compute: ({ drives }) => {
      const hdds = drives.filter(d => d.rpm > 0)
      const byRpm = {}
      for (const d of hdds) byRpm[d.rpm] = (byRpm[d.rpm] || 0) + 1
      return { value: String(hdds.length), rows: Object.entries(byRpm).map(([rpm, n]) => [`${Number(rpm).toLocaleString('en-US')} rpm`, String(n)]), note: 'Spinning drives.' }
    },
  },
  warranty_warnings: {
    label: 'Warranty',
    compute: ({ profiles = [], drives }) => {
      const tracked = profiles.filter(p => p.warranty_days_remaining != null)
      const expiring = tracked.filter(p => p.warranty_days_remaining <= 90).sort((a, b) => a.warranty_days_remaining - b.warranty_days_remaining)
      const byS = Object.fromEntries(drives.map(d => [d.serial, d]))
      const rows = [
        ['Expired or expiring', plural(expiring.length, 'drive')],
        ...expiring.slice(0, 3).map(p => [driveName(byS[p.serial]) || p.serial, p.warranty_days_remaining < 0 ? 'Expired' : `${p.warranty_days_remaining} days`]),
        ['Tracked', `${tracked.length} of ${drives.length}`],
      ]
      return {
        value: String(expiring.length), rows,
        note: 'Add a purchase date and warranty length from Edit bay and drive.',
        tone: expiring.length ? 'warn' : null,
      }
    },
  },
  disconnected: {
    label: 'Disconnected',
    compute: (ctx) => {
      const off = ctx.drives.filter(d => d.is_connected === false)
      return { value: String(off.length), rows: off.slice(0, 4).map(d => [driveName(d), where(ctx, d)]), note: 'Not detected at the last scan.' }
    },
  },
  uncorrectable: {
    label: 'Uncorrectable',
    compute: ({ drives }) => {
      const affected = drives.filter(d => (d.uncorrectable_errors || 0) > 0)
      const total = affected.reduce((s, d) => s + d.uncorrectable_errors, 0)
      return {
        value: String(total), rows: affected.slice(0, 4).map(d => [driveName(d), String(d.uncorrectable_errors)]),
        note: 'Errors the drive could not recover from.', tone: total ? 'down' : null,
      }
    },
  },
  zfs_pools: {
    label: 'ZFS pools',
    compute: ({ drives, pools = [] }) => {
      const names = new Set([...pools.map(p => p.name), ...drives.map(d => d.zfs_pool).filter(Boolean)])
      const rows = [...names].map(n => {
        const p = pools.find(x => x.name === n)
        const count = drives.filter(d => d.zfs_pool === n).length
        return [n, p ? `${p.capacity_pct}% used, ${plural(count, 'drive')}` : plural(count, 'drive')]
      })
      return { value: String(names.size), rows, note: 'Pools found at the last scan.' }
    },
  },
}

export const WIDGET_IDS = Object.keys(WIDGETS)

export function isValidWidgetList(ids) {
  return Array.isArray(ids) && ids.every(id => WIDGETS[id])
}

export function computeWidget(id, ctx) {
  const w = WIDGETS[id]
  if (!w) return null
  return { id, label: w.label, spark: !!w.spark, ...w.compute(ctx) }
}
