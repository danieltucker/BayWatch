import { describe, expect, it } from 'vitest'
import {
  attentionItems, bayLabel, bayState, buildLocations, counterDelta, driveStatus, fleetSummary,
  gaugeSegments, heroCopy, placeableBays, placementIndex, poolGroups, tempBand, tempSpread, tempTrend, unplacedDrives,
} from './fleet'
import { computeWidget, DEFAULT_WIDGET_IDS, isValidWidgetList } from './widgets'
import { fmtAge, fmtCap, fmtDate } from './format'

const drive = (serial, extra = {}) => ({
  serial, make: 'Toshiba', model: 'MG08', smart_status: 'PASSED', is_connected: true,
  temperature_c: 35, capacity_bytes: 16e12, power_on_hours: 9000, ...extra,
})

const T = { warnC: 55, dangerC: 60 }

describe('driveStatus', () => {
  it('maps SMART + counters onto the four shared states', () => {
    expect(driveStatus(drive('a'))).toBe('up')
    expect(driveStatus(drive('a', { reallocated_sectors: 3 }))).toBe('warn')
    expect(driveStatus(drive('a', { smart_status: 'FAILED' }))).toBe('down')
    expect(driveStatus(drive('a', { smart_status: 'UNKNOWN' }))).toBe('muted')
  })
  it('treats disconnected drives as muted, whatever their last SMART state', () => {
    expect(driveStatus(drive('a', { is_connected: false, smart_status: 'FAILED' }))).toBe('muted')
  })
})

describe('tempBand', () => {
  it('follows the configured thresholds', () => {
    expect(tempBand(30, T)).toBe('cool')
    expect(tempBand(31, T)).toBe('normal')
    expect(tempBand(54, T)).toBe('normal')
    expect(tempBand(55, T)).toBe('warn')
    expect(tempBand(60, T)).toBe('down')
    expect(tempBand(null, T)).toBe(null)
  })
  it('moves with custom thresholds', () => {
    expect(tempBand(42, { warnC: 40, dangerC: 45 })).toBe('warn')
  })
})

describe('bays', () => {
  it('labels bays 1-based unless they have a custom label', () => {
    expect(bayLabel({ row: 0, col: 3 })).toBe('1-4')
    expect(bayLabel({ row: 0, col: 0, label: 'NVMe' })).toBe('NVMe')
  })
  it('derives bay state', () => {
    expect(bayState({ status: 'damaged' }, drive('a'))).toBe('damaged')
    expect(bayState({ status: 'normal' }, null)).toBe('empty')
    expect(bayState({ status: 'hot_spare' }, drive('a'))).toBe('live')
  })
})

describe('poolGroups', () => {
  it('orders vdevs naturally, puts spares last, and gives each a colour', () => {
    const ds = [
      drive('a', { vdev_name: 'raidz1-10' }), drive('b', { vdev_name: 'raidz1-2' }),
      drive('c', { vdev_name: 'raidz1-2' }), drive('d', { vdev_name: 'spare-1' }), drive('e'),
    ]
    const g = poolGroups(ds)
    expect(g.map(x => x.key)).toEqual(['raidz1-2', 'raidz1-10', 'spare'])
    expect(g[0].count).toBe(2)
    expect(new Set(g.map(x => x.color)).size).toBe(3)
  })
  it('counts a bay marked hot spare as a spare', () => {
    const g = poolGroups([drive('a', { vdev_name: 'raidz1-1' })], { a: { status: 'hot_spare' } })
    expect(g.map(x => x.key)).toEqual(['spare'])
  })
})

const enclosures = [
  { id: 1, name: 'Intrepid', type: 'server', arrays: [{ id: 10, name: 'Core Storage', rows: 2, cols: 2, group_type: 'zfs_raidz1' }] },
  { id: 2, name: 'Cold Storage', type: 'jbod', arrays: [{ id: 20, name: 'Shelf', rows: 2, cols: 1 }] },
]
const baysMap = {
  10: [
    { id: 1, row: 0, col: 0, status: 'normal', drive_serial: 'a' },
    { id: 2, row: 0, col: 1, status: 'damaged', drive_serial: null },
    { id: 3, row: 1, col: 0, status: 'normal', drive_serial: 'b' },
    { id: 4, row: 1, col: 1, status: 'normal', drive_serial: null },
  ],
  20: [
    { id: 5, row: 0, col: 0, status: 'normal', drive_serial: 'c' },
    { id: 6, row: 1, col: 0, status: 'normal', drive_serial: 'd' },
  ],
}
const drives = [
  drive('a'), drive('b', { reallocated_sectors: 4 }),
  drive('c', { is_connected: false }), drive('d', { is_connected: false, smart_status: 'UNKNOWN' }),
]
const driveMap = Object.fromEntries(drives.map(d => [d.serial, d]))

describe('buildLocations', () => {
  const locs = buildLocations({
    enclosures, baysMap, driveMap,
    federation: [{ target_id: 7, target_name: 'Backup box', target_url: 'http://x', drives: [drive('r1')], bays: [{ row: 0, col: 2, enclosure_name: 'Chassis', array_name: 'Front', drive_serial: 'r1' }] }],
  })
  it('summarises each location and flags fully-disconnected ones as offline', () => {
    expect(locs.map(l => l.name)).toEqual(['Intrepid', 'Cold Storage', 'Backup box'])
    expect(locs[0]).toMatchObject({ kind: 'server', populated: 2, bayCount: 4, offline: false, sub: 'Server, 2 drives' })
    expect(locs[1]).toMatchObject({ kind: 'shelf', offline: true, sub: 'Shelf, 2 drives' })
  })
  it('turns federated snapshots into read-only remote locations', () => {
    expect(locs[2]).toMatchObject({ kind: 'remote', remote: true, sub: 'Remote, 1 drive' })
    expect(locs[2].arrays[0].array).toMatchObject({ rows: 1, cols: 3 })
  })
  it('indexes placements for local drives only', () => {
    const idx = placementIndex(locs)
    expect(idx.b.bay.id).toBe(3)
    expect(idx.r1).toBeUndefined()
  })
})

describe('attentionItems', () => {
  const locations = buildLocations({ enclosures, baysMap, driveMap })
  it('lists damaged bays, errors, reallocated sectors and disconnected drives', () => {
    const items = attentionItems({ drives, locations, thresholds: T })
    expect(items.map(i => i.id)).toEqual(['damaged', 'errors', 'realloc', 'offline'])
    expect(items[0]).toMatchObject({ tone: 'down', title: '1 bay marked damaged', detail: '1-2' })
    expect(items[3]).toMatchObject({ title: '2 drives disconnected', detail: 'Cold Storage' })
  })
  it('is empty when everything is fine (the all-clear state)', () => {
    const fine = [drive('a'), drive('b')]
    const locs = buildLocations({ enclosures: [enclosures[0]], baysMap: { 10: baysMap[10].map(b => ({ ...b, status: 'normal' })) }, driveMap: Object.fromEntries(fine.map(d => [d.serial, d])) })
    expect(attentionItems({ drives: fine, locations: locs, thresholds: T })).toEqual([])
  })
  it('lists drives that are not in a bay, pointing at the placement flow', () => {
    const extra = [...drives, drive('loose1'), drive('loose2', { is_connected: false })]
    const items = attentionItems({ drives: extra, locations, thresholds: T })
    const it_ = items.find(i => i.id === 'unplaced')
    expect(it_).toMatchObject({ tone: 'muted', title: '2 drives not in a bay', detail: '1 empty bay available', to: { kind: 'place' } })
  })
  it('sends you to Settings when there is nowhere to place a drive', () => {
    const full = { 10: baysMap[10].map((b, i) => ({ ...b, status: 'normal', drive_serial: b.drive_serial || `f${i}` })) }
    const ds = [...full[10].map(b => drive(b.drive_serial)), drive('loose')]
    const locs = buildLocations({ enclosures: [enclosures[0]], baysMap: full, driveMap: Object.fromEntries(ds.map(d => [d.serial, d])) })
    expect(attentionItems({ drives: ds, locations: locs, thresholds: T }).find(i => i.id === 'unplaced').to).toEqual({ kind: 'settings' })
  })
  it('flags hot drives using the thresholds', () => {
    const items = attentionItems({ drives: [drive('a', { temperature_c: 61 })], locations: [], thresholds: T })
    expect(items[0]).toMatchObject({ id: 'hot', tone: 'down' })
  })
})

describe('placement helpers', () => {
  const locations = buildLocations({ enclosures, baysMap, driveMap })
  it('lists empty, usable bays in reading order and skips damaged ones', () => {
    expect(placeableBays(locations[0]).map(x => bayLabel(x.bay))).toEqual(['2-2'])
    expect(placeableBays(locations[1])).toEqual([])
    expect(placeableBays({ remote: true, arrays: [] })).toEqual([])
  })
  it('orders unplaced drives connected-first', () => {
    const ds = [drive('z', { model: 'A', is_connected: false }), drive('y', { model: 'B' }), drive('a')]
    expect(unplacedDrives(ds, { a: {} }).map(d => d.serial)).toEqual(['y', 'z'])
  })
})

describe('fleet summary, gauge and hero copy', () => {
  it('counts and orders segments healthiest first', () => {
    const s = fleetSummary(drives)
    expect(s).toMatchObject({ total: 4, passed: 3, up: 1, warn: 1, muted: 2, offline: 2, pct: 75 })
    const segs = gaugeSegments(drives)
    expect(segs).toHaveLength(4)
    expect(segs.map(x => x.status)).toEqual(['up', 'warn', 'muted', 'muted'])
    expect(segs[0].d).toMatch(/^M/)
  })
  it('writes the all-clear headline when nothing needs attention', () => {
    const s = fleetSummary([drive('a')])
    expect(heroCopy({ summary: s, attention: [], primaryName: 'Intrepid' }).title).toBe('Everything is running smoothly')
    expect(heroCopy({ summary: s, attention: [{ tone: 'warn' }], primaryName: 'Intrepid' }).title).toBe('Intrepid is running well')
    expect(heroCopy({ summary: s, attention: [{ tone: 'down' }], primaryName: 'Intrepid' }).title).toBe('Intrepid is running well')
    expect(heroCopy({ summary: s, attention: [{ tone: 'down', urgent: true }], primaryName: 'Intrepid' }).title).toBe('Something needs you now')
  })
})

describe('tempSpread', () => {
  it('builds a 1°C histogram over connected drives', () => {
    const { bins, avg } = tempSpread([drive('a', { temperature_c: 30 }), drive('b', { temperature_c: 32 }), drive('c', { temperature_c: 32 }), drive('d', { temperature_c: 50, is_connected: false })])
    expect(bins.map(b => [b.t, b.count])).toEqual([[30, 1], [31, 0], [32, 2]])
    expect(avg).toBe(31)
  })
  it('widens bins for a large range', () => {
    const { bins, binSize } = tempSpread([drive('a', { temperature_c: 20 }), drive('b', { temperature_c: 60 })])
    expect(binSize).toBeGreaterThan(1)
    expect(bins.length).toBeLessThanOrEqual(15)
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(2)
  })
})

describe('history helpers', () => {
  it('sums a cumulative counter across resets', () => {
    const h = [{ read_bytes: 100 }, { read_bytes: 150 }, { read_bytes: 20 }, { read_bytes: 70 }]
    expect(counterDelta(h, 'read_bytes')).toBe(50 + 20 + 50)
    expect(counterDelta([{ read_bytes: 5 }], 'read_bytes')).toBe(null)
  })
  it('describes the temperature trend', () => {
    expect(tempTrend([{ temperature_c: 33 }, { temperature_c: 34 }, { temperature_c: 33 }])).toBe('Steady')
    expect(tempTrend([30, 30, 31, 35, 36, 37].map(t => ({ temperature_c: t })))).toBe('Rising')
  })
})

describe('widgets', () => {
  const locations = buildLocations({ enclosures, baysMap, driveMap })
  const ctx = { drives, driveMap, profiles: [{ serial: 'a', warranty_days_remaining: 30 }], locations, placement: placementIndex(locations), pools: [], thresholds: T }
  it('every default widget computes a value', () => {
    expect(isValidWidgetList(DEFAULT_WIDGET_IDS)).toBe(true)
    for (const id of DEFAULT_WIDGET_IDS) expect(computeWidget(id, ctx).value).toBeTruthy()
  })
  it('reports warranty and reallocated counts', () => {
    expect(computeWidget('warranty_warnings', ctx)).toMatchObject({ value: '1', tone: 'warn' })
    expect(computeWidget('reallocated', ctx)).toMatchObject({ value: '4', tone: 'warn' })
  })
  it('rejects unknown widget ids from stale saved config', () => {
    expect(isValidWidgetList(['avg_temp', 'nope'])).toBe(false)
  })
})

describe('format', () => {
  it('formats capacity, age and dates', () => {
    expect(fmtCap(16e12)).toBe('16.0 TB')
    expect(fmtCap(240e9)).toBe('240 GB')
    expect(fmtAge(60400)).toBe('6.9y')
    expect(fmtAge(4300)).toBe('5.9mo')
    expect(fmtDate('2025-11-01')).toBe('Nov 1, 2025')
  })
})
