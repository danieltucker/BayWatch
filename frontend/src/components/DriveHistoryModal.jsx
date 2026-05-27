import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { getDriveHistory } from '../api/client'
import { useTempThresholds } from '../context/TempThresholdContext'

const tooltipStyle = {
  fontSize: 10, padding: '4px 8px', borderRadius: 6,
  border: 'none', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0',
}
const axisStyle = { fontSize: 8, fill: 'currentColor' }

export default function DriveHistoryModal({ serial, make, model, onClose }) {
  const { warnC, dangerC } = useTempThresholds()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDriveHistory(serial, 90)
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [serial])

  const tempHistory = history
    .filter(h => h.temperature_c != null)
    .map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      temp: h.temperature_c,
    }))

  const spaceHistory = history
    .filter(h => h.used_bytes != null)
    .map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      usedGB: parseFloat((h.used_bytes / 1e9).toFixed(2)),
    }))

  const reallocHistory = history
    .filter(h => h.reallocated_sectors != null)
    .map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sectors: h.reallocated_sectors,
    }))
  const hasReallocHistory = reallocHistory.some(h => h.sectors > 0)

  const ioHistory = (() => {
    const pts = history.filter(h => h.read_bytes != null)
    if (pts.length < 2) return []
    const result = []
    for (let i = 1; i < pts.length; i++) {
      const dr = pts[i].read_bytes - pts[i - 1].read_bytes
      const dw = pts[i].write_bytes - pts[i - 1].write_bytes
      if (dr < 0 || dw < 0) continue
      result.push({
        date: new Date(pts[i].recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        readMB: Math.round(dr / 1048576),
        writeMB: Math.round(dw / 1048576),
      })
    }
    return result
  })()

  const ioMaxMB = ioHistory.length ? Math.max(...ioHistory.map(h => Math.max(h.readMB, h.writeMB))) : 0
  const ioUnit = ioMaxMB >= 1000 ? 'GB' : 'MB'
  const ioData = ioUnit === 'GB'
    ? ioHistory.map(h => ({ ...h, readMB: +(h.readMB / 1024).toFixed(2), writeMB: +(h.writeMB / 1024).toFixed(2) }))
    : ioHistory

  const tempMin = tempHistory.length ? Math.min(...tempHistory.map(h => h.temp)) : 25
  const tempMax = tempHistory.length ? Math.max(...tempHistory.map(h => h.temp)) : 65
  const tempDomainLow  = Math.min(25, tempMin - 2)
  const tempDomainHigh = Math.max(65, tempMax + 2)

  const title = [make, model].filter(Boolean).join(' ') || serial

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 font-mono">{serial} · 90-day history</p>
            </div>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {loading && (
              <p className="text-sm text-slate-400 dark:text-gray-600 text-center py-8">Loading…</p>
            )}

            {!loading && tempHistory.length > 1 && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-2">Temperature (90d)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={tempHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="hTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} domain={[tempDomainLow, tempDomainHigh]} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}°C`, 'Temp']} labelStyle={{ color: '#94a3b8' }} />
                    <ReferenceLine y={warnC}   stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: `${warnC}°`, position: 'right', fontSize: 7, fill: '#f59e0b' }} />
                    <ReferenceLine y={dangerC} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: `${dangerC}°`, position: 'right', fontSize: 7, fill: '#ef4444' }} />
                    <Area type="monotone" dataKey="temp" stroke="#38bdf8" fill="url(#hTempGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {!loading && spaceHistory.length > 1 && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-2">Used Space (90d)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={spaceHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="hSpaceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2dd4bf" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} unit=" GB" />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} GB`, 'Used']} labelStyle={{ color: '#94a3b8' }} />
                    <Area type="monotone" dataKey="usedGB" stroke="#2dd4bf" fill="url(#hSpaceGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {!loading && hasReallocHistory && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-2">Reallocated Sectors (90d)</p>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={reallocHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="hReallocGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [v, 'Sectors']} labelStyle={{ color: '#94a3b8' }} />
                    <Area type="monotone" dataKey="sectors" stroke="#f59e0b" fill="url(#hReallocGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {!loading && ioHistory.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-0.5">I/O Activity (90d)</p>
                <p className="text-[9px] text-slate-300 dark:text-gray-700 mb-2">{ioUnit} per scan interval</p>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-gray-600"><span className="w-2 h-0.5 rounded bg-emerald-400 inline-block" />Read</span>
                  <span className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-gray-600"><span className="w-2 h-0.5 rounded bg-violet-400 inline-block" />Write</span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={ioData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="hReadGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="hWriteGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} unit={` ${ioUnit}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v.toLocaleString()} ${ioUnit}`, n === 'readMB' ? 'Read' : 'Write']} labelStyle={{ color: '#94a3b8' }} />
                    <Area type="monotone" dataKey="readMB"  stroke="#34d399" fill="url(#hReadGrad)"  strokeWidth={1.5} dot={false} />
                    <Area type="monotone" dataKey="writeMB" stroke="#a78bfa" fill="url(#hWriteGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {!loading && tempHistory.length <= 1 && spaceHistory.length <= 1 && !hasReallocHistory && ioHistory.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-gray-600 text-center py-8">No history data available yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
