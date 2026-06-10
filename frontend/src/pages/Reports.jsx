import { useState, useEffect } from 'react'
import { BarChart2, Clock, ChevronRight, Trash2, CheckCircle2, XCircle, AlertTriangle, HardDrive, Thermometer, Database, Wifi, WifiOff } from 'lucide-react'
import { getReports, generateReport, getReport, deleteReport } from '../api/client'

function fmt(dt) {
  return new Date(dt).toLocaleString()
}

function fmtDate(dt) {
  return new Date(dt).toLocaleDateString()
}

function fmtHours(h) {
  if (h == null) return '—'
  if (h >= 8760) return `${(h / 8760).toFixed(1)}y`
  if (h >= 720) return `${(h / 720).toFixed(1)}mo`
  return `${h.toLocaleString()}h`
}

function SmartPill({ status }) {
  const s = {
    PASSED: { label: 'Passed', style: { background: 'var(--wt-up-50)', border: '1px solid var(--wt-up-100)', color: 'var(--wt-up-700)' } },
    FAILED: { label: 'Failed', style: { background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)', color: 'var(--wt-down-700)' } },
  }[status] ?? { label: status || 'Unknown', style: { background: 'var(--wt-surface-2)', border: '1px solid var(--wt-border)', color: 'var(--wt-text-muted)' } }
  return (
    <span className="wt-mono text-[10px] font-semibold px-2 py-0.5 rounded-full" style={s.style}>{s.label}</span>
  )
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="wt-card flex items-center gap-3 px-4 py-3 flex-1">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--wt-surface-2)', color }}>
        <Icon size={15} />
      </div>
      <div>
        <p className="wt-eyebrow">{label}</p>
        <p className="wt-mono font-bold leading-none mt-0.5" style={{ fontSize: 'var(--wt-text-lg)', color }}>{value}</p>
      </div>
    </div>
  )
}

function ReportView({ report }) {
  const d = report.data
  const { summary, inventory, smart_events, temperature, pools } = d
  const [activeTab, setActiveTab] = useState('inventory')
  const tabs = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'smart', label: `SMART Events${smart_events.length ? ` (${smart_events.length})` : ''}` },
    { key: 'temperature', label: 'Temperature' },
    { key: 'pools', label: 'Pools' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <SummaryCard icon={HardDrive} label="Total Drives" value={summary.total_drives} color="var(--wt-text-muted)" />
        <SummaryCard icon={CheckCircle2} label="SMART Passed" value={summary.passed} color="var(--wt-up-600)" />
        <SummaryCard icon={XCircle} label="SMART Failed" value={summary.failed} color={summary.failed > 0 ? 'var(--wt-down-500)' : 'var(--wt-text-faint)'} />
        <SummaryCard icon={AlertTriangle} label="With Errors" value={summary.drives_with_errors} color={summary.drives_with_errors > 0 ? 'var(--wt-warn-600)' : 'var(--wt-text-faint)'} />
        {summary.disconnected > 0 && (
          <SummaryCard icon={WifiOff} label="Disconnected" value={summary.disconnected} color="var(--wt-warn-600)" />
        )}
        {summary.avg_temp_c != null && (
          <SummaryCard icon={Thermometer} label="Avg Temp" value={`${summary.avg_temp_c}°C`} color="var(--wt-teal-500)" />
        )}
      </div>

      <div className="wt-seg self-start">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} aria-selected={activeTab === t.key}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'inventory' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--wt-border)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--wt-surface-2)', borderBottom: '1px solid var(--wt-border)' }}>
                {['Drive', 'Serial', 'Type', 'SMART', 'Temp', 'Hours', 'Capacity', 'Pool', 'Bay'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory.map(d => (
                <tr key={d.serial} className="last:border-0" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="font-medium" style={{ color: 'var(--wt-text)' }}>{[d.make, d.model].filter(Boolean).join(' ') || '—'}</p>
                    {!d.is_connected && <span className="text-[10px]" style={{ color: 'var(--wt-warn-600)' }}>Disconnected</span>}
                  </td>
                  <td className="px-3 py-2"><code className="wt-mono" style={{ color: 'var(--wt-text-muted)' }}>{d.serial}</code></td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>{d.drive_type || d.form_factor || '—'}</td>
                  <td className="px-3 py-2"><SmartPill status={d.smart_status} /></td>
                  <td className="px-3 py-2 wt-mono whitespace-nowrap" style={{ color: d.temperature_c >= 65 ? 'var(--wt-down-500)' : d.temperature_c >= 55 ? 'var(--wt-warn-500)' : 'var(--wt-text-muted)' }}>
                    {d.temperature_c != null ? `${d.temperature_c}°C` : '—'}
                  </td>
                  <td className="px-3 py-2 wt-mono whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>{fmtHours(d.power_on_hours)}</td>
                  <td className="px-3 py-2 wt-mono whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>{d.capacity || '—'}</td>
                  <td className="px-3 py-2 wt-mono whitespace-nowrap" style={{ color: 'var(--wt-brand-500)' }}>{d.zfs_pool || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--wt-text-faint)' }}>
                    {[d.enclosure, d.array, d.bay].filter(Boolean).join(' › ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'smart' && (
        smart_events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12" style={{ color: 'var(--wt-text-faint)' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--wt-up-500)' }} />
            <p className="text-sm">No SMART events — all drives healthy</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--wt-border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--wt-surface-2)', borderBottom: '1px solid var(--wt-border)' }}>
                  {['Drive', 'Serial', 'Event', 'Detail'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--wt-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {smart_events.map((e, i) => (
                  <tr key={i} className="last:border-0" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                    <td className="px-3 py-2 whitespace-nowrap font-medium" style={{ color: 'var(--wt-text)' }}>{[e.make, e.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-2"><code className="wt-mono" style={{ color: 'var(--wt-text-muted)' }}>{e.serial}</code></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="wt-mono text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={e.event_type === 'smart_failed'
                          ? { background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)', color: 'var(--wt-down-700)' }
                          : { background: 'var(--wt-warn-50)', border: '1px solid var(--wt-warn-100)', color: 'var(--wt-warn-700)' }
                        }>
                        {e.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--wt-text-muted)' }}>{e.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeTab === 'temperature' && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--wt-border)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--wt-surface-2)', borderBottom: '1px solid var(--wt-border)' }}>
                {['Drive', 'Current', 'Avg', 'Peak', 'Hrs ≥ Warn', 'Hrs ≥ Danger'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {temperature.map(t => (
                <tr key={t.serial} className="last:border-0" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <p className="font-medium" style={{ color: 'var(--wt-text)' }}>{[t.make, t.model].filter(Boolean).join(' ') || t.serial}</p>
                    <code className="wt-mono text-[10px]" style={{ color: 'var(--wt-text-faint)' }}>{t.serial}</code>
                  </td>
                  {[t.current_temp, t.avg_temp, t.peak_temp].map((v, i) => (
                    <td key={i} className="px-3 py-2 wt-mono whitespace-nowrap"
                      style={{ color: v >= 65 ? 'var(--wt-down-500)' : v >= 55 ? 'var(--wt-warn-500)' : v != null ? 'var(--wt-text-muted)' : 'var(--wt-text-faint)' }}>
                      {v != null ? `${v}°C` : '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2 wt-mono whitespace-nowrap" style={{ color: (t.hours_above_warn || 0) > 0 ? 'var(--wt-warn-600)' : 'var(--wt-text-faint)' }}>
                    {t.hours_above_warn != null ? `${t.hours_above_warn}h` : '—'}
                  </td>
                  <td className="px-3 py-2 wt-mono whitespace-nowrap" style={{ color: (t.hours_above_danger || 0) > 0 ? 'var(--wt-down-500)' : 'var(--wt-text-faint)' }}>
                    {t.hours_above_danger != null ? `${t.hours_above_danger}h` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'pools' && (
        pools.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--wt-text-faint)' }}>No ZFS pool data recorded</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pools.map(p => (
              <div key={p.name} className="wt-card px-4 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklch, var(--wt-brand-500) 10%, transparent)', color: 'var(--wt-brand-500)' }}>
                  <Database size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--wt-text)' }}>{p.name}</p>
                  {p.vdevs.length > 0 && (
                    <p className="wt-mono text-[11px]" style={{ color: 'var(--wt-text-faint)' }}>{p.vdevs.join(', ')}</p>
                  )}
                </div>
                <span className="wt-mono text-xs shrink-0" style={{ color: 'var(--wt-text-muted)' }}>{p.drive_count} drive{p.drive_count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

export default function Reports() {
  const [periodDays, setPeriodDays] = useState(30)
  const [generating, setGenerating] = useState(false)
  const [activeReport, setActiveReport] = useState(null)
  const [pastReports, setPastReports] = useState([])
  const [error, setError] = useState(null)
  const [loadingReport, setLoadingReport] = useState(null)

  useEffect(() => {
    getReports().then(setPastReports).catch(() => {})
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const report = await generateReport(periodDays)
      setActiveReport(report)
      setPastReports(prev => [{ id: report.id, generated_at: report.generated_at, period_days: report.period_days, period_start: report.period_start, period_end: report.period_end }, ...prev])
    } catch {
      setError('Report generation failed — check the app logs.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleOpenReport(r) {
    if (activeReport?.id === r.id) return
    setLoadingReport(r.id)
    try {
      const full = await getReport(r.id)
      setActiveReport(full)
    } catch {
      setError('Failed to load report.')
    } finally {
      setLoadingReport(null)
    }
  }

  async function handleDeleteReport(id, e) {
    e.stopPropagation()
    await deleteReport(id)
    setPastReports(prev => prev.filter(r => r.id !== id))
    if (activeReport?.id === id) setActiveReport(null)
  }

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-5xl">
      <div>
        <h1 className="font-bold" style={{ fontSize: 'var(--wt-text-2xl)', color: 'var(--wt-text)', letterSpacing: '-0.02em' }}>Reports</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--wt-text-muted)' }}>Generate and export drive health reports</p>
      </div>

      {/* Generate panel */}
      <div className="wt-card p-5 flex flex-col gap-4">
        <div>
          <span className="wt-eyebrow">Time Range</span>
          <div className="wt-seg mt-2 self-start">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setPeriodDays(d)} aria-selected={periodDays === d}>{d}D</button>
            ))}
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)', color: 'var(--wt-down-600)' }}>
            {error}
          </div>
        )}
        <button onClick={handleGenerate} disabled={generating} className="wt-btn wt-btn--primary disabled:opacity-50 self-start">
          <BarChart2 size={14} />
          {generating ? 'Generating…' : 'Generate report'}
        </button>
      </div>

      {/* Preview */}
      <div className="wt-card p-5" style={{ minHeight: '220px' }}>
        {generating ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: 'var(--wt-text-faint)' }}>
            <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--wt-brand-100)', borderTopColor: 'var(--wt-brand-500)' }} />
            <p className="text-sm">Generating report…</p>
          </div>
        ) : activeReport ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="wt-eyebrow">Report</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--wt-text-muted)' }}>
                  {fmtDate(activeReport.period_start)} — {fmtDate(activeReport.period_end)}
                  <span className="ml-2 wt-mono text-xs" style={{ color: 'var(--wt-text-faint)' }}>Generated {fmt(activeReport.generated_at)}</span>
                </p>
              </div>
            </div>
            <ReportView report={activeReport} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: 'var(--wt-text-faint)' }}>
            <BarChart2 size={28} />
            <p className="text-sm wt-mono">Select a time range and click Generate report</p>
          </div>
        )}
      </div>

      {/* Past reports */}
      {pastReports.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="wt-eyebrow">Past Reports</span>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--wt-border)' }}>
            {pastReports.map((r, i) => (
              <button
                key={r.id}
                onClick={() => handleOpenReport(r)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--wt-surface-2)]"
                style={{ borderTop: i > 0 ? '1px solid var(--wt-border)' : 'none', background: activeReport?.id === r.id ? 'color-mix(in oklch, var(--wt-brand-500) 8%, transparent)' : undefined }}
              >
                {loadingReport === r.id
                  ? <div className="w-4 h-4 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: 'var(--wt-brand-100)', borderTopColor: 'var(--wt-brand-500)' }} />
                  : <Clock size={15} className="shrink-0" style={{ color: 'var(--wt-text-faint)' }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--wt-text)' }}>
                    {fmtDate(r.period_start)} — {fmtDate(r.period_end)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--wt-text-faint)' }}>Generated {fmt(r.generated_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDeleteReport(r.id, e)}
                    className="p-1.5 rounded transition-colors"
                    style={{ color: 'var(--wt-text-faint)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-down-500)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}
                    title="Delete report">
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={15} style={{ color: 'var(--wt-text-faint)' }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
