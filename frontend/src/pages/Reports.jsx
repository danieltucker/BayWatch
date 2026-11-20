import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarChart3, Check, ChevronRight, Clock, Download, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import AppHeader from '../components/shell/AppHeader'
import { SmartPill, Spinner } from '../components/ui/bits'
import { useTempThresholds } from '../context/TempThresholdContext'
import { useIsMobile } from '../hooks/useMediaQuery'
import { deleteReport, generateReport, getReport, getReports, getReportSchedule, saveReportSchedule } from '../api/client'
import { downloadText } from '../lib/export'
import { fmtAge, fmtDateTime, plural } from '../lib/format'
import { tempBand } from '../lib/fleet'

// ── Export builders (unchanged columns) ────────────────────────────────────

const fmtD = dt => new Date(dt).toLocaleDateString()
const fileStem = r => `baywatch-report-${fmtD(r.period_start).replace(/\//g, '-')}`

function buildInventoryRows(inventory) {
  return inventory.map(d => ({
    Drive: [d.make, d.model].filter(Boolean).join(' ') || '—',
    Serial: d.serial,
    Type: d.drive_type || d.form_factor || '—',
    SMART: d.smart_status || '—',
    'Temp (°C)': d.temperature_c ?? '—',
    'Age (hrs)': d.power_on_hours ?? '—',
    Capacity: d.capacity || '—',
    Pool: d.zfs_pool || '—',
    Bay: [d.enclosure, d.array, d.bay].filter(Boolean).join(' › ') || '—',
    Connected: d.is_connected === false ? 'No' : 'Yes',
  }))
}
const buildSmartRows = ev => ev.map(e => ({ Drive: [e.make, e.model].filter(Boolean).join(' ') || '—', Serial: e.serial, Event: e.event_type.replace(/_/g, ' '), Detail: e.description }))
const buildTempRows = ts => ts.map(t => ({
  Drive: [t.make, t.model].filter(Boolean).join(' ') || t.serial, Serial: t.serial,
  'Current (°C)': t.current_temp ?? '—', 'Avg (°C)': t.avg_temp ?? '—', 'Peak (°C)': t.peak_temp ?? '—',
  'Hrs ≥ Warn': t.hours_above_warn ?? '—', 'Hrs ≥ Danger': t.hours_above_danger ?? '—',
}))
const buildPoolRows = ps => ps.map(p => ({ Pool: p.name, Drives: p.drive_count, vDevs: p.vdevs.join(', ') || '—' }))

function exportCSV(report) {
  const rows = buildInventoryRows(report.data.inventory)
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  downloadText([headers.join(','), ...rows.map(r => headers.map(h => cell(r[h])).join(','))].join('\n'), `${fileStem(report)}.csv`)
}
function exportXLSX(report) {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of [
    ['Inventory', buildInventoryRows(report.data.inventory)], ['SMART Events', buildSmartRows(report.data.smart_events)],
    ['Temperature', buildTempRows(report.data.temperature)], ['Pools', buildPoolRows(report.data.pools)],
  ]) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name)
  XLSX.writeFile(wb, `${fileStem(report)}.xlsx`)
}
function mdTable(rows) {
  if (!rows.length) return '_No data_\n'
  const h = Object.keys(rows[0])
  return [`| ${h.join(' | ')} |`, `| ${h.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${h.map(k => String(r[k] ?? '—')).join(' | ')} |`)].join('\n') + '\n'
}
function exportMD(report) {
  const d = report.data, s = d.summary
  const lines = [
    '# BayWatch Report', `**Period:** ${fmtD(report.period_start)} — ${fmtD(report.period_end)}  `, `**Generated:** ${new Date(report.generated_at).toLocaleString()}`, '',
    '## Summary', '', '| Metric | Value |', '| --- | --- |',
    `| Total drives | ${s.total_drives} |`, `| SMART passed | ${s.passed} |`, `| SMART failed | ${s.failed} |`, `| With errors | ${s.drives_with_errors} |`,
    s.avg_temp_c != null ? `| Avg temperature | ${s.avg_temp_c}°C |` : null, s.disconnected > 0 ? `| Disconnected | ${s.disconnected} |` : null, '',
    '## Inventory', '', mdTable(buildInventoryRows(d.inventory)), '## SMART Events', '', mdTable(buildSmartRows(d.smart_events)),
    '## Temperature', '', mdTable(buildTempRows(d.temperature)), '## Pools', '', mdTable(buildPoolRows(d.pools)),
  ].filter(l => l !== null).join('\n')
  downloadText(lines, `${fileStem(report)}.md`, 'text/markdown')
}

// ── Report view ────────────────────────────────────────────────────────────

const TABS = [['inventory', 'Inventory'], ['smart', 'SMART events'], ['temperature', 'Temperature'], ['pools', 'Pools']]
const INV_PREVIEW = 10

function Kpis({ s }) {
  const items = [
    ['Total drives', s.total_drives],
    ['SMART passed', s.passed, s.passed === s.total_drives ? 'up' : null],
    ['SMART failed', s.failed, s.failed ? 'down' : null],
    ['With errors', s.drives_with_errors, s.drives_with_errors ? 'warn' : null],
    ['Disconnected', s.disconnected ?? 0, null],
    ['Avg temp', s.avg_temp_c != null ? `${s.avg_temp_c}°C` : '—', null],
  ]
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
      {items.map(([k, v, tone]) => (
        <div key={k} className="bw-stat">
          <div className="bw-stat__label">{k}</div>
          <div className="bw-metric bw-stat__value" style={tone ? { color: `var(--wt-${tone}-600)` } : undefined}>{v}</div>
        </div>
      ))}
    </div>
  )
}

function Inventory({ rows, isMobile }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, INV_PREVIEW)
  const bay = d => [d.enclosure, d.bay].filter(Boolean).join(' · ') || '—'
  return (
    <div>
      {isMobile ? (
        <div className="flex flex-col">
          {shown.map(d => (
            <div key={d.serial} className="bw-row" style={{ alignItems: 'flex-start' }}>
              <div className="flex-1 min-w-0">
                <span className="bw-row__title truncate">{[d.make, d.model].filter(Boolean).join(' ') || d.serial}</span>
                <span className="bw-row__detail wt-mono">{d.serial}</span>
                <span className="bw-row__detail">{bay(d)}{d.zfs_pool ? <> · <span className="wt-mono">{d.zfs_pool}</span></> : null}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <SmartPill status={d.smart_status} />
                <span className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>{d.temperature_c != null ? `${d.temperature_c}°C` : '—'} · {fmtAge(d.power_on_hours)}</span>
                {d.is_connected === false && <span className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>Disconnected</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto" style={{ margin: '0 calc(-1 * var(--wt-6))' }}>
          <table className="bw-table" style={{ minWidth: 980 }}>
            <thead><tr>{['Drive', 'Serial', 'Type', 'SMART', 'Temp', 'Age', 'Capacity', 'Pool', 'Bay'].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(d => (
                <tr key={d.serial}>
                  <td style={{ maxWidth: 260 }}>
                    <span className="block font-semibold truncate">{[d.make, d.model].filter(Boolean).join(' ') || '—'}</span>
                    {d.is_connected === false && <span className="block text-xs" style={{ color: 'var(--wt-text-muted)' }}>Disconnected</span>}
                  </td>
                  <td className="wt-mono" style={{ fontSize: 12.5, color: 'var(--wt-text-muted)' }}>{d.serial}</td>
                  <td style={{ color: 'var(--wt-text-muted)' }}>{d.drive_type?.replace(/_/g, ' ') || d.form_factor || '—'}</td>
                  <td><SmartPill status={d.smart_status} /></td>
                  <td className="wt-mono">{d.temperature_c != null ? `${d.temperature_c}°C` : '—'}</td>
                  <td className="wt-mono">{fmtAge(d.power_on_hours)}</td>
                  <td className="wt-mono">{d.capacity || '—'}</td>
                  <td className="wt-mono" style={{ fontSize: 12.5 }}>{d.zfs_pool || '—'}</td>
                  <td className="truncate" style={{ color: 'var(--wt-text-muted)', maxWidth: 220 }}>{bay(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-2 pt-3 text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>
        <span>Showing <span className="wt-mono">{shown.length}</span> of <span className="wt-mono">{rows.length}</span> drives</span>
        <span className="flex gap-4">
          {rows.length > INV_PREVIEW && (
            <button type="button" className="font-semibold" style={{ color: 'var(--bw-ink)', minHeight: 32 }} onClick={() => setAll(a => !a)}>
              {all ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
          <Link to="/drives" className="font-semibold inline-flex items-center" style={{ color: 'var(--bw-ink)', minHeight: 32 }}>View all in Drives</Link>
        </span>
      </div>
    </div>
  )
}

function SmartEvents({ events }) {
  if (!events.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-sm" style={{ color: 'var(--wt-text-muted)' }}>
        <span className="bw-chipicon bw-chipicon--up" style={{ width: 44, height: 44 }}><Check size={20} aria-hidden="true" /></span>
        No SMART events in this period. All drives healthy.
      </div>
    )
  }
  return (
    <div>
      {events.map((e, i) => {
        const failed = e.event_type === 'smart_failed'
        return (
          <div key={i} className="bw-row">
            <span className="flex-1 min-w-0">
              <span className="bw-row__title truncate">{[e.make, e.model].filter(Boolean).join(' ') || '—'}</span>
              <span className="bw-row__detail wt-mono">{e.serial}</span>
            </span>
            <span className="flex-1 min-w-0" style={{ color: 'var(--wt-text-muted)' }}>{e.description}</span>
            <span className={`wt-pill ${failed ? 'wt-pill--solid-down' : 'wt-pill--warn'}`}>{failed ? 'Failed' : 'Warning'}</span>
          </div>
        )
      })}
    </div>
  )
}

function TempRanges({ temperature, inventory, thresholds }) {
  const LO = 20, HI = Math.max(50, thresholds.dangerC + 5)
  const pos = t => Math.max(0, Math.min(100, ((t - LO) / (HI - LO)) * 100))
  const poolOf = Object.fromEntries(inventory.map(d => [d.serial, d.zfs_pool || 'Not in a pool']))
  const groups = useMemo(() => {
    const g = {}
    for (const t of temperature) {
      const lo = t.avg_temp ?? t.current_temp, hi = t.peak_temp ?? t.current_temp, avg = t.avg_temp ?? t.current_temp
      if (lo == null) continue
      const k = poolOf[t.serial] || 'Not in a pool'
      const x = (g[k] ||= { name: k, n: 0, min: Infinity, max: -Infinity, sum: 0 })
      x.n++; x.min = Math.min(x.min, lo, t.current_temp ?? lo); x.max = Math.max(x.max, hi); x.sum += avg
    }
    return Object.values(g).map(x => ({ ...x, avg: Math.round((x.sum / x.n) * 10) / 10 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, inventory])

  const band = t => tempBand(t, thresholds)
  const color = t => (band(t) === 'down' ? 'var(--wt-down-500)' : band(t) === 'warn' ? 'var(--wt-warn-500)' : 'var(--wt-viz-1)')
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="grid gap-3 items-center pb-2 text-xs font-semibold" style={{ gridTemplateColumns: 'minmax(120px,1fr) 2fr auto', color: 'var(--wt-text-muted)' }}>
          <span>Group</span><span>Range, {LO} to {HI}°C</span><span>Min / avg / max</span>
        </div>
        {groups.map(g => (
          <div key={g.name} className="grid gap-3 items-center py-3" style={{ gridTemplateColumns: 'minmax(120px,1fr) 2fr auto', borderTop: '1px solid var(--wt-border)' }}>
            <span className="min-w-0">
              <span className="block font-semibold truncate">{g.name}</span>
              <span className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>{plural(g.n, 'drive')}</span>
            </span>
            <div className="relative h-3 rounded-full" style={{ background: 'var(--wt-n-150)' }} role="img"
              aria-label={`${g.name}: ${g.min} to ${g.max} degrees, average ${g.avg}`}>
              <div className="absolute top-0 h-3 rounded-full" style={{ left: `${pos(g.min)}%`, width: `${Math.max(1.5, pos(g.max) - pos(g.min))}%`, background: color(g.max) }} />
              <div className="absolute rounded-sm" style={{ top: -3, height: 18, width: 3, left: `calc(${pos(g.avg)}% - 1px)`, background: 'var(--wt-text)' }} />
              <div className="absolute" style={{ top: -3, height: 18, width: 1, left: `${pos(thresholds.warnC)}%`, borderLeft: '1px dashed var(--wt-warn-500)' }} aria-hidden="true" />
            </div>
            <span className="wt-mono text-[13px]">{g.min} / {g.avg} / {g.max}°C</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto" style={{ margin: '0 calc(-1 * var(--wt-6))' }}>
        <table className="bw-table" style={{ minWidth: 640 }}>
          <thead><tr>{['Drive', 'Current', 'Avg', 'Peak', `Hrs ≥ ${thresholds.warnC}°C`, `Hrs ≥ ${thresholds.dangerC}°C`].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {temperature.map(t => (
              <tr key={t.serial}>
                <td>
                  <span className="block font-semibold">{[t.make, t.model].filter(Boolean).join(' ') || t.serial}</span>
                  <span className="wt-mono text-[11px]" style={{ color: 'var(--wt-text-subtle)' }}>{t.serial}</span>
                </td>
                {[t.current_temp, t.avg_temp, t.peak_temp].map((v, i) => {
                  const b = band(v)
                  return <td key={i} className="wt-mono" style={b === 'warn' || b === 'down' ? { color: `var(--wt-${b}-600)`, fontWeight: 600 } : undefined}>{v != null ? `${v}°C` : '—'}</td>
                })}
                <td className="wt-mono" style={t.hours_above_warn ? { color: 'var(--wt-warn-600)' } : { color: 'var(--wt-text-faint)' }}>{t.hours_above_warn != null ? `${t.hours_above_warn}h` : '—'}</td>
                <td className="wt-mono" style={t.hours_above_danger ? { color: 'var(--wt-down-600)' } : { color: 'var(--wt-text-faint)' }}>{t.hours_above_danger != null ? `${t.hours_above_danger}h` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Pools({ pools }) {
  if (!pools.length) return <p className="bw-sub py-8 text-center">No ZFS pool data recorded.</p>
  return (
    <div className="flex flex-wrap gap-4">
      {pools.map(p => (
        <div key={p.name} className="bw-stat" style={{ flex: '1 1 320px', padding: '18px 20px' }}>
          <div className="flex justify-between items-center gap-3">
            <span className="font-bold" style={{ fontSize: 'var(--wt-text-md)' }}>{p.name}</span>
            <span className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>{plural(p.drive_count, 'drive')}</span>
          </div>
          {p.vdevs.length > 0 && <div className="bw-tags mt-3">{[...p.vdevs].sort().map(v => <span key={v} className="wt-chip wt-chip--plain">{v}</span>)}</div>}
        </div>
      ))}
    </div>
  )
}

function ReportView({ report, isMobile, thresholds, tab, setTab }) {
  const { summary, inventory, smart_events, temperature, pools } = report.data
  return (
    <section aria-label="Report" className="bw-card bw-card--pad flex flex-col gap-5" data-screen-label="Report">
      <div className="bw-card__head">
        <div>
          <span className="wt-eyebrow">Report · {report.period_days} days</span>
          <div className="font-bold mt-1.5" style={{ fontSize: 'var(--wt-text-md)' }}>
            <span className="wt-mono">{fmtD(report.period_start)}</span> to <span className="wt-mono">{fmtD(report.period_end)}</span>
          </div>
          <div className="bw-sub">Generated {fmtDateTime(report.generated_at)}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="wt-eyebrow mr-1">Export</span>
          {[['CSV', exportCSV], ['XLS', exportXLSX], ['MD', exportMD]].map(([l, fn]) => (
            <button key={l} type="button" className="wt-btn wt-btn--secondary" style={{ minHeight: 40 }} onClick={() => fn(report)} aria-label={`Export as ${l}`}>
              <Download size={14} aria-hidden="true" />{l}
            </button>
          ))}
        </div>
      </div>
      <Kpis s={summary} />
      <div role="tablist" aria-label="Report sections" className="bw-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-controls={`panel-${k}`} aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}{k === 'smart' && smart_events.length ? <span className="wt-mono"> ({smart_events.length})</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'inventory' && <Inventory rows={inventory} isMobile={isMobile} />}
        {tab === 'smart' && <SmartEvents events={smart_events} />}
        {tab === 'temperature' && <TempRanges temperature={temperature} inventory={inventory} thresholds={thresholds} />}
        {tab === 'pools' && <Pools pools={pools} />}
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Reports() {
  const isMobile = useIsMobile()
  const thresholds = useTempThresholds()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'inventory'
  const setTab = k => setParams(p => { const n = new URLSearchParams(p); n.set('tab', k); return n }, { replace: true })

  const [periodDays, setPeriodDays] = useState(7)
  const [generating, setGenerating] = useState(false)
  const [active, setActive] = useState(null)
  const [past, setPast] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [schedule, setSchedule] = useState({ enabled: false, frequency: 'weekly', period_days: 30 })
  const [scheduleSaving, setScheduleSaving] = useState(false)

  useEffect(() => {
    getReports().then(list => {
      setPast(list)
      if (list[0]) getReport(list[0].id).then(setActive).catch(() => {})
    }).catch(() => {}).finally(() => setLoadingList(false))
    getReportSchedule().then(setSchedule).catch(() => {})
  }, [])

  async function saveSchedule(next) {
    setSchedule(next)
    setScheduleSaving(true)
    try { await saveReportSchedule(next) } catch { /* shown as unsaved on reload */ } finally { setScheduleSaving(false) }
  }

  async function generate() {
    setGenerating(true); setError(null)
    try {
      const r = await generateReport(periodDays)
      setActive(r)
      setPast(prev => [{ id: r.id, generated_at: r.generated_at, period_days: r.period_days, period_start: r.period_start, period_end: r.period_end }, ...prev])
    } catch {
      setError('Report generation failed. Check the app logs.')
    } finally {
      setGenerating(false)
    }
  }

  async function open(r) {
    if (active?.id === r.id) return
    setLoadingId(r.id)
    try { setActive(await getReport(r.id)) } catch { setError('Failed to load report.') } finally { setLoadingId(null) }
  }

  async function remove(id) {
    await deleteReport(id)
    setPast(prev => prev.filter(r => r.id !== id))
    if (active?.id === id) setActive(null)
    setConfirmId(null)
  }

  const sched = schedule.enabled
  return (
    <div className="bw-page" data-screen-label="Reports">
      <AppHeader />
      <div>
        <span className="wt-eyebrow">Health reports</span>
        <h1 className="bw-h1 mt-1.5">Reports</h1>
        <p className="bw-sub">Generate and export drive health reports</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <section className="bw-card bw-card--pad flex flex-col gap-4" style={{ flex: '1 1 340px' }} aria-label="New report">
          <div className="font-semibold">New report</div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>Time range</span>
            <div role="group" aria-label="Time range" className="bw-seg">
              {[7, 30, 90].map(d => <button key={d} type="button" aria-pressed={periodDays === d} onClick={() => setPeriodDays(d)}>{d}D</button>)}
            </div>
          </div>
          {error && <div className="wt-pill wt-pill--down" role="alert" style={{ borderRadius: 'var(--wt-r-md)', padding: '8px 12px' }}>{error}</div>}
          <button type="button" className="wt-btn wt-btn--primary bw-btn-lg self-start disabled:opacity-60" onClick={generate} disabled={generating}>
            <BarChart3 size={16} aria-hidden="true" />{generating ? 'Generating…' : 'Generate report'}
          </button>
        </section>

        <section className="bw-card bw-card--pad flex flex-col gap-4" style={{ flex: '1 1 340px' }} aria-label="Scheduled generation">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="font-semibold">Scheduled generation</div>
              <div className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>A notification is sent when the report is ready.</div>
            </div>
            <label className="wt-switch" style={{ marginTop: 2 }}>
              <input type="checkbox" role="switch" aria-label="Scheduled generation" checked={sched} onChange={e => saveSchedule({ ...schedule, enabled: e.target.checked })} />
              <span className="wt-switch__track" />
            </label>
          </div>
          {sched ? (
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <span className="wt-eyebrow block mb-2">Frequency</span>
                <div role="group" aria-label="Frequency" className="bw-seg">
                  {['daily', 'weekly', 'monthly'].map(f => (
                    <button key={f} type="button" aria-pressed={schedule.frequency === f} onClick={() => saveSchedule({ ...schedule, frequency: f })}>{f}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="wt-eyebrow block mb-2">Period</span>
                <div role="group" aria-label="Report period" className="bw-seg">
                  {[7, 30, 90].map(d => <button key={d} type="button" aria-pressed={schedule.period_days === d} onClick={() => saveSchedule({ ...schedule, period_days: d })}>{d}D</button>)}
                </div>
              </div>
              {scheduleSaving && <span className="text-xs" style={{ color: 'var(--wt-text-faint)' }}>Saving…</span>}
            </div>
          ) : (
            <div className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>Turn on to auto-generate reports on a recurring schedule.</div>
          )}
        </section>
      </div>

      {generating ? <div className="bw-card"><Spinner label="Generating report…" /></div>
        : active ? <ReportView report={active} isMobile={isMobile} thresholds={thresholds} tab={tab} setTab={setTab} />
        : loadingList ? <div className="bw-card"><Spinner label="Loading reports…" /></div>
        : (
          <div className="bw-card bw-card--pad flex flex-col items-center gap-2 py-12" style={{ color: 'var(--wt-text-muted)' }}>
            <BarChart3 size={28} aria-hidden="true" />
            <p className="text-sm">Pick a time range and generate your first report.</p>
          </div>
        )}

      {past.length > 0 && (
        <section aria-label="Past reports" className="flex flex-col gap-2">
          <span className="wt-eyebrow">Past reports</span>
          <div className="bw-card" style={{ padding: '0 var(--wt-5)' }}>
            {past.map((r, i) => (
              <div key={r.id} className="bw-row" style={i === 0 ? { borderTop: 0 } : undefined}>
                <button type="button" className="flex items-center gap-3 flex-1 min-w-0 text-left" style={{ minHeight: 44 }} onClick={() => open(r)} aria-current={active?.id === r.id ? 'true' : undefined}>
                  {loadingId === r.id
                    ? <span className="w-4 h-4 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: 'var(--wt-n-150)', borderTopColor: 'var(--bw-ink)' }} />
                    : <Clock size={15} className="shrink-0" aria-hidden="true" style={{ color: active?.id === r.id ? 'var(--bw-ink)' : 'var(--wt-text-faint)' }} />}
                  <span className="min-w-0">
                    <span className="bw-row__title" style={active?.id === r.id ? { color: 'var(--bw-ink)' } : undefined}>
                      <span className="wt-mono">{fmtD(r.period_start)}</span> to <span className="wt-mono">{fmtD(r.period_end)}</span>
                    </span>
                    <span className="bw-row__detail">Generated {fmtDateTime(r.generated_at)}</span>
                  </span>
                </button>
                {confirmId === r.id ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>Delete?</span>
                    <button type="button" className="wt-btn wt-btn--danger wt-btn--sm" style={{ minHeight: 36 }} onClick={() => remove(r.id)}>Yes</button>
                    <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" style={{ minHeight: 36 }} onClick={() => setConfirmId(null)}>No</button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <button type="button" className="bw-iconbtn" style={{ border: 0, background: 'transparent', color: 'var(--wt-down-600)' }}
                      aria-label={`Delete report ${fmtD(r.period_start)} to ${fmtD(r.period_end)}`} onClick={() => setConfirmId(r.id)}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                    <ChevronRight size={15} aria-hidden="true" style={{ color: 'var(--wt-text-faint)' }} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
