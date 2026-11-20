// Dev-only mock of the BayWatch API, for working on the UI without drives, smartctl or Python.
// Response shapes follow backend/api/schemas.py. All data is invented and deterministic.
//
//   npm run dev:mock            UI + mock with issues (damaged bays, reallocated sectors, offline shelf)
//   npm run dev:mock -- --clear  UI + mock in the all-clear state
//
// Writes (bay assign/status/label, profiles, config, reports) are kept in memory until restart.
// Never imported by src/, so it is not part of the production bundle.
import http from 'node:http'

const CLEAR = process.argv.includes('--clear') || process.env.SCENARIO === 'clear'
let seed = 42
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pick = xs => xs[Math.floor(rnd() * xs.length)]
const now = Date.now()
const iso = ms => new Date(ms).toISOString()

// ── Fixtures (invented) ────────────────────────────────────────────────────
const MODELS = [
  ['Toshiba', 'MG08ACA16TE', 16e12], ['Toshiba', 'MG07ACA14TE', 14e12], ['Seagate', 'Exos X18', 16e12],
  ['Seagate', 'Exos X16', 16e12], ['WDC', 'Ultrastar HC550', 16e12], ['HGST', 'Ultrastar He12', 12e12],
]
const serial = (p) => p + Array.from({ length: 8 }, () => pick('0123456789ABCDEFGHJKLMNPQRSTUVWXYZ')).join('')

const enclosures = [
  { id: 1, name: 'Intrepid', type: 'server', description: null, display_order: 0, arrays: [
    { id: 10, enclosure_id: 1, name: 'Core Storage', rows: 6, cols: 4, display_order: 0, group_type: 'zfs_raidz1', purpose: null },
    { id: 11, enclosure_id: 1, name: 'NVMe slot', rows: 1, cols: 1, display_order: 1, group_type: 'standalone', purpose: 'TrueNAS OS drive' },
  ] },
  { id: 2, name: 'Cold Storage', type: 'jbod', description: null, display_order: 1, arrays: [
    { id: 20, enclosure_id: 2, name: 'Shelf', rows: 5, cols: 1, display_order: 0, group_type: 'drive_bays', purpose: null },
  ] },
]

const drives = []
const bays = {}
let bayId = 1
const devs = 'abcdefghijklmnopqrstuvwxyz'.split('')
let devI = 0
function mkDrive(extra) {
  const [make, model, cap] = pick(MODELS)
  const d = {
    serial: serial(make.slice(0, 2).toUpperCase()), device_path: `/dev/sd${devs[devI++ % 26]}`, by_id_path: null,
    make, model, capacity_bytes: cap, rpm: 7200, form_factor: '3.5"', firmware_version: pick(['0102', 'SN04', 'RT05', '4303']),
    smart_status: 'PASSED', temperature_c: 30 + Math.floor(rnd() * 10), power_on_hours: 3000 + Math.floor(rnd() * 55000),
    reallocated_sectors: 0, pending_sectors: 0, uncorrectable_errors: 0, last_scanned: iso(now - 3 * 60000),
    zfs_pool: null, vdev_name: null, is_connected: true, drive_type: 'enterprise_hdd',
    zfs_read_errors: 0, zfs_write_errors: 0, zfs_checksum_errors: 0, ...extra,
  }
  drives.push(d)
  return d
}

// Core Storage: 6×4, two damaged bays (2-3, 2-4), spare at 4-3.
bays[10] = []
let vdevN = 0
for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
  const damaged = !CLEAR && r === 1 && (c === 2 || c === 3)
  const empty = CLEAR && r === 1 && (c === 2 || c === 3)
  const spare = r === 3 && c === 2
  let d = null
  if (!damaged && !empty) {
    d = mkDrive({ zfs_pool: 'tank', vdev_name: spare ? 'spare-1' : `raidz1-${(vdevN++ % 3) + 1}` })
  }
  bays[10].push({ id: bayId++, array_id: 10, row: r, col: c, label: null, status: damaged ? 'damaged' : spare ? 'hot_spare' : 'normal', drive_serial: d?.serial ?? null })
}
// One drive with reallocated sectors, one hot one.
if (!CLEAR) { drives[4].reallocated_sectors = 15; drives[9].temperature_c = 41 }
drives[9].temperature_c = Math.max(drives[9].temperature_c, 40)

// NVMe boot drive
const nvme = mkDrive({ make: 'Kingston', model: 'SA400S37240G', capacity_bytes: 240e9, rpm: 0, form_factor: 'M.2', device_path: '/dev/nvme0n1', temperature_c: 26, power_on_hours: 25400, zfs_pool: 'boot-pool', vdev_name: null, drive_type: 'consumer_ssd' })
bays[11] = [{ id: bayId++, array_id: 11, row: 0, col: 0, label: 'NVMe', status: 'normal', drive_serial: nvme.serial }]

// Cold Storage shelf: offline (connected in the all-clear scenario).
bays[20] = []
for (let r = 0; r < 5; r++) {
  const d = mkDrive({ make: 'HGST', model: 'Ultrastar He12', capacity_bytes: 12e12, is_connected: CLEAR, temperature_c: CLEAR ? 28 + r : null,
    smart_status: !CLEAR && r === 2 ? 'UNKNOWN' : 'PASSED', power_on_hours: !CLEAR && r === 2 ? null : 38000 + r * 4100, last_scanned: iso(now - 14 * 864e5) })
  bays[20].push({ id: bayId++, array_id: 20, row: r, col: 0, label: null, status: 'normal', drive_serial: d.serial })
}

const profiles = {}
drives.slice(0, 18).forEach((d, i) => {
  const months = i % 3 === 0 ? 60 : 36
  const bought = new Date(now - (i % 5 === 0 ? 34 : 12 + i) * 30 * 864e5)
  const expiry = new Date(bought); expiry.setMonth(expiry.getMonth() + months)
  profiles[d.serial] = {
    serial: d.serial, purchase_date: bought.toISOString().slice(0, 10), mfg_date: null, warranty_months: months,
    purchase_price: null, vendor: i % 2 ? 'ServerPartDeals' : null, notes: i === 0 ? 'Replaced the old 8 TB drive in this bay.' : null, rated_tbw: null,
    warranty_expiry: expiry.toISOString().slice(0, 10), warranty_days_remaining: Math.round((expiry - now) / 864e5),
  }
})

const pools = [
  { name: 'tank', size_bytes: 310e12, alloc_bytes: 136e12, free_bytes: 174e12, capacity_pct: 43 },
  { name: 'boot-pool', size_bytes: 220e9, alloc_bytes: 12e9, free_bytes: 208e9, capacity_pct: 5 },
]
const tankDrives = drives.filter(d => d.zfs_pool === 'tank')
const topology = [{
  name: 'tank', state: 'ONLINE', scan_status: 'scrub repaired 0B with 0 errors',
  vdevs: ['raidz1-1', 'raidz1-2', 'raidz1-3'].map(v => ({ name: v, type: 'raidz1', state: 'ONLINE',
    disks: tankDrives.filter(d => d.vdev_name === v).map(d => ({ path: d.device_path, state: 'ONLINE', read_errors: 0, write_errors: 0, cksum_errors: 0 })) }))
    .concat([{ name: 'spares', type: 'spare', state: 'AVAIL', disks: tankDrives.filter(d => d.vdev_name === 'spare-1').map(d => ({ path: d.device_path, state: 'AVAIL', read_errors: 0, write_errors: 0, cksum_errors: 0 })) }]),
}]

// Remote instance (federation)
const remoteDrives = Array.from({ length: 6 }, (_, i) => ({ ...mkRemote(i) }))
function mkRemote(i) {
  const [make, model, cap] = pick(MODELS)
  return { serial: serial('RM'), make, model, capacity_bytes: cap, rpm: 7200, form_factor: '3.5"', smart_status: 'PASSED',
    temperature_c: 31 + i, power_on_hours: 12000 + i * 3000, reallocated_sectors: 0, pending_sectors: 0, uncorrectable_errors: 0,
    is_connected: true, zfs_pool: 'backup', vdev_name: 'mirror-' + (Math.floor(i / 2) + 1), device_path: `/dev/sd${devs[i]}` }
}
const federation = [{
  target_id: 1, target_name: 'Backup box', target_url: 'http://10.0.0.42:8080', fetched_at: iso(now - 9 * 60000),
  drives: remoteDrives,
  bays: remoteDrives.map((d, i) => ({ id: 900 + i, array_id: 90, row: Math.floor(i / 3), col: i % 3, label: null, status: 'normal', drive_serial: d.serial, enclosure_name: 'Chassis', array_name: 'Front bays' })),
  pools: [{ name: 'backup', size_bytes: 48e12, alloc_bytes: 21e12, free_bytes: 27e12, capacity_pct: 44 }],
}]

function history(serialNo, days) {
  const d = drives.find(x => x.serial === serialNo)
  if (!d || d.temperature_c == null) return []
  const out = []
  let rb = 5e14 * rnd(), wb = 2e14 * rnd()
  const pts = days * 4
  for (let i = 0; i < pts; i++) {
    rb += 4e9 + 1e10 * rnd(); wb += 1.5e9 + 4e9 * rnd()
    const spike = rnd() > 0.96 ? 4 : 0
    out.push({ id: i, drive_serial: serialNo, recorded_at: iso(now - (pts - i) * 6 * 3600e3),
      temperature_c: d.temperature_c - 1 + Math.round(rnd() * 2) + spike, reallocated_sectors: d.reallocated_sectors,
      power_on_hours: d.power_on_hours - (pts - i) * 6, read_bytes: Math.round(rb), write_bytes: Math.round(wb), used_bytes: null })
  }
  return out
}

const config = {}
const reports = []
const alerts = CLEAR ? [] : [
  { id: 1, type: 'status', drive_serial: drives[4].serial, channel: 'telegram', message: `${drives[4].model}: 15 reallocated sectors`, sent_at: iso(now - 3600e3) },
]
const alertConfig = { id: 1, channel: 'telegram', status_frequency: 'daily', critical_enabled: true, warranty_warning_days: 90,
  temp_warn_threshold_c: 45, temp_alert_threshold_c: 50, log_level: 'INFO', zfs_warn_threshold: 1, zfs_critical_threshold: 50 }

function placement(s) {
  for (const e of enclosures) for (const a of e.arrays) for (const b of bays[a.id]) if (b.drive_serial === s) return { enclosure: e.name, array: a.name, bay: b.label || `R${b.row + 1}C${b.col + 1}` }
  return {}
}
function makeReport(period) {
  const id = reports.length + 1
  const inv = drives.map(d => ({ ...d, capacity: d.capacity_bytes >= 1e12 ? `${(d.capacity_bytes / 1e12).toFixed(1)} TB` : `${Math.round(d.capacity_bytes / 1e9)} GB`, ...placement(d.serial) }))
  const ev = drives.filter(d => d.reallocated_sectors).map(d => ({ serial: d.serial, make: d.make, model: d.model, event_type: 'reallocated_sectors', value: d.reallocated_sectors, description: `${d.reallocated_sectors} reallocated sector(s)` }))
  const temps = drives.map(d => { const h = history(d.serial, period); const t = h.map(x => x.temperature_c)
    return { serial: d.serial, make: d.make, model: d.model, current_temp: d.temperature_c, avg_temp: t.length ? +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(1) : null, peak_temp: t.length ? Math.max(...t) : null, hours_above_warn: t.length ? t.filter(x => x >= 45).length * 6 : null, hours_above_danger: t.length ? 0 : null, data_points: t.length } })
  const live = drives.filter(d => d.temperature_c != null)
  const r = { id, generated_at: iso(Date.now()), period_days: period, period_start: iso(now - period * 864e5), period_end: iso(now),
    data: { summary: { total_drives: drives.length, passed: drives.filter(d => d.smart_status === 'PASSED').length, failed: 0, unknown: drives.filter(d => d.smart_status === 'UNKNOWN').length,
      avg_temp_c: +(live.reduce((a, d) => a + d.temperature_c, 0) / live.length).toFixed(1), drives_with_errors: ev.length, disconnected: drives.filter(d => !d.is_connected).length },
      inventory: inv, smart_events: ev, temperature: temps,
      pools: [{ name: 'tank', drive_count: tankDrives.length, vdevs: ['raidz1-1', 'raidz1-2', 'raidz1-3', 'spare-1'] }, { name: 'boot-pool', drive_count: 1, vdevs: [] }] } }
  reports.unshift(r)
  return r
}
makeReport(7)

// ── Server ─────────────────────────────────────────────────────────────────
const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)) }
const allBays = () => Object.values(bays).flat()

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname.replace(/^\/api/, '')
  let body = null
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const chunks = []; for await (const c of req) chunks.push(c)
    try { body = JSON.parse(Buffer.concat(chunks).toString() || 'null') } catch { body = null }
  }
  const m = (re) => p.match(re)
  let r
  if (req.method === 'GET' && p === '/health') return send(res, 200, { status: 'ok', version: 'mock' })
  if (req.method === 'GET' && p === '/enclosures') return send(res, 200, enclosures)
  if (req.method === 'GET' && (r = m(/^\/bays\/array\/(\d+)$/))) return send(res, 200, bays[r[1]] || [])
  if (req.method === 'PUT' && (r = m(/^\/bays\/(\d+)\/assign$/))) {
    const b = allBays().find(x => x.id === +r[1]); if (!b) return send(res, 404, { detail: 'Bay not found' })
    if (body.drive_serial) for (const x of allBays()) if (x.drive_serial === body.drive_serial) x.drive_serial = null
    b.drive_serial = body.drive_serial; return send(res, 200, b)
  }
  if (req.method === 'PUT' && (r = m(/^\/bays\/(\d+)\/status$/))) { const b = allBays().find(x => x.id === +r[1]); b.status = body.status; return send(res, 200, b) }
  if (req.method === 'PUT' && (r = m(/^\/bays\/(\d+)\/label$/))) { const b = allBays().find(x => x.id === +r[1]); b.label = url.searchParams.get('label') || null; return send(res, 200, { ok: true }) }
  if (req.method === 'GET' && p === '/drives') return send(res, 200, drives)
  if (req.method === 'GET' && p === '/drives/logs') return send(res, 200, [])
  if (req.method === 'POST' && p === '/drives/scan') return send(res, 202, { status: 'started' })
  if (req.method === 'GET' && (r = m(/^\/drives\/([^/]+)\/partitions$/))) return send(res, 200, [])
  if (req.method === 'GET' && (r = m(/^\/drives\/([^/]+)$/))) { const d = drives.find(x => x.serial === decodeURIComponent(r[1])); return d ? send(res, 200, d) : send(res, 404, { detail: 'Drive not found' }) }
  if (req.method === 'DELETE' && (r = m(/^\/drives\/([^/]+)$/))) { const i = drives.findIndex(x => x.serial === r[1]); if (i >= 0) drives.splice(i, 1); return send(res, 204) }
  if (req.method === 'GET' && p === '/profiles') return send(res, 200, Object.values(profiles))
  if (req.method === 'GET' && (r = m(/^\/profiles\/([^/]+)$/))) return profiles[r[1]] ? send(res, 200, profiles[r[1]]) : send(res, 404, { detail: 'no profile' })
  if (req.method === 'PUT' && (r = m(/^\/profiles\/([^/]+)$/))) { profiles[r[1]] = { serial: r[1], ...(profiles[r[1]] || {}), ...body }; return send(res, 200, profiles[r[1]]) }
  if (req.method === 'GET' && p === '/pools') return send(res, 200, pools)
  if (req.method === 'GET' && p === '/pools/topology') return send(res, 200, topology)
  if (req.method === 'GET' && p === '/federation/data') return send(res, 200, federation)
  if (req.method === 'GET' && p === '/federation/targets') return send(res, 200, [{ id: 1, name: 'Backup box', url: 'http://10.0.0.42:8080', enabled: true, sync_interval_minutes: 15, last_synced_at: federation[0].fetched_at, last_error: null }])
  if (req.method === 'GET' && (r = m(/^\/federation\/targets\/\d+\/drives\/([^/]+)\/history$/))) return send(res, 200, { history: [], error: null })
  if (req.method === 'GET' && (r = m(/^\/history\/drives\/([^/]+)$/))) return send(res, 200, history(decodeURIComponent(r[1]), +(url.searchParams.get('days') || 30)))
  if (req.method === 'GET' && (r = m(/^\/history\/arrays\/(\d+)$/))) {
    const days = +(url.searchParams.get('days') || 30)
    return send(res, 200, r[1] === '10' ? Array.from({ length: days }, (_, i) => ({ date: iso(now - (days - i) * 864e5).slice(0, 10), avg_temp_c: +(34 + Math.sin(i / 3) * 0.8 + rnd() * 0.6).toFixed(1) })) : [])
  }
  if (req.method === 'GET' && p.startsWith('/history/pools/')) return send(res, 200, [])
  if (req.method === 'GET' && p === '/alerts') return send(res, 200, alerts)
  if (req.method === 'GET' && p === '/alerts/config') return send(res, 200, alertConfig)
  if (req.method === 'GET' && p === '/api-keys') return send(res, 200, [])
  if (req.method === 'GET' && (r = m(/^\/config\/(.+)$/))) return config[r[1]] ? send(res, 200, { key: r[1], value: config[r[1]] }) : send(res, 404, { detail: 'Config key not found' })
  if (req.method === 'PUT' && (r = m(/^\/config\/(.+)$/))) { config[r[1]] = body.value; return send(res, 200, { key: r[1], value: body.value }) }
  if (req.method === 'GET' && p === '/reports') return send(res, 200, reports.map(({ data, ...x }) => x))
  if (req.method === 'POST' && p === '/reports') return send(res, 201, makeReport(body?.period_days || 30))
  if (req.method === 'GET' && (r = m(/^\/reports\/(\d+)$/))) return send(res, 200, reports.find(x => x.id === +r[1]))
  if (req.method === 'DELETE' && (r = m(/^\/reports\/(\d+)$/))) { const i = reports.findIndex(x => x.id === +r[1]); reports.splice(i, 1); return send(res, 204) }
  send(res, 404, { detail: `mock: no route ${req.method} ${p}` })
}).listen(+(process.env.PORT || 8000), () => console.log(`mock API (${CLEAR ? 'all clear' : 'issues'}) on :${process.env.PORT || 8000}`))
