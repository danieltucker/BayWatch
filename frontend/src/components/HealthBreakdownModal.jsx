import { X } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { useTempThresholds } from '../context/TempThresholdContext'

function scoreLabel(score) {
  if (score == null) return { label: 'Unknown', color: '#94a3b8' }
  if (score >= 90) return { label: 'Excellent', color: '#22c55e' }
  if (score >= 75) return { label: 'Good',      color: '#4ade80' }
  if (score >= 60) return { label: 'Fair',      color: '#f59e0b' }
  if (score >= 40) return { label: 'Poor',      color: '#f97316' }
  return              { label: 'Critical',  color: '#ef4444' }
}

function recommendation(score, breakdown) {
  if (score === 0 || breakdown.some(b => b.factor === 'SMART failure'))
    return { text: 'Replace immediately — SMART failure detected', color: 'text-red-500 dark:text-red-400' }
  const hasErrors = breakdown.some(b =>
    (b.factor === 'Reallocated sectors' || b.factor === 'Pending sectors' || b.factor === 'Uncorrectable errors') && b.delta < 0
  )
  if (score < 40 || hasErrors)
    return { text: 'Replace soon — significant SMART errors or wear detected', color: 'text-red-400 dark:text-red-400' }
  if (score < 60)
    return { text: 'Replace when possible — health declining', color: 'text-orange-500 dark:text-orange-400' }
  if (score < 75)
    return { text: 'Monitor closely — approaching end of expected lifespan', color: 'text-amber-500 dark:text-amber-400' }
  if (score < 90)
    return { text: 'Healthy — minor wear factors present', color: 'text-emerald-600 dark:text-emerald-400' }
  return { text: 'Excellent health — no concerns', color: 'text-emerald-500 dark:text-emerald-400' }
}

export default function HealthBreakdownModal({ drive, score, breakdown, history = [], onClose }) {
  const { warnC, dangerC } = useTempThresholds()
  const { label: scoreLabel_, color } = scoreLabel(score)
  const rec = recommendation(score, breakdown)
  const r = 32, circ = 2 * Math.PI * r
  const fill = (score / 100) * circ

  const tempHistory = history
    .filter(h => h.temperature_c != null)
    .map(h => ({
      date: new Date(h.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      temp: h.temperature_c,
    }))

  const tooltipStyle = {
    fontSize: 10, padding: '4px 8px', borderRadius: 6,
    border: 'none', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0',
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-12">
        <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Health Breakdown</p>
              <p className="text-xs font-mono text-slate-400 dark:text-gray-500">{drive.serial}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">

            {/* Score ring */}
            <div className="flex items-center gap-5">
              <div className="relative w-[72px] h-[72px] shrink-0">
                <svg width={72} height={72} className="-rotate-90">
                  <circle cx={36} cy={36} r={r} fill="none" stroke="currentColor"
                    className="text-slate-200 dark:text-gray-800" strokeWidth={5} />
                  <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={5}
                    strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color }}>{score}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold leading-tight" style={{ color }}>{scoreLabel_}</p>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{drive.make} {drive.model}</p>
                <p className={`text-xs mt-2 font-medium ${rec.color}`}>{rec.text}</p>
              </div>
            </div>

            {/* Factor breakdown */}
            <section>
              <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">Score Factors</p>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-gray-800/60">
                {breakdown.map((b, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 dark:text-gray-300 font-medium">{b.factor}</p>
                      <p className="text-[10px] text-slate-400 dark:text-gray-600 leading-snug">{b.detail}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 tabular-nums ${
                      b.positive || b.delta === 0
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : b.delta <= -20 ? 'text-red-500 dark:text-red-400'
                        : b.delta <= -10 ? 'text-orange-500 dark:text-orange-400'
                        : 'text-amber-500 dark:text-amber-400'
                    }`}>
                      {b.delta === 0 ? '+0' : b.delta}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">Final Score</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color }}>{score} / 100</span>
                </div>
              </div>
            </section>

            {/* Temp history chart if available */}
            {tempHistory.length > 1 && (
              <section>
                <p className="text-xs font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  Temperature History ({tempHistory.length} readings)
                </p>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={tempHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="hbTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 8, fill: 'currentColor' }} className="text-slate-400 dark:text-gray-600" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}°C`, 'Temp']} labelStyle={{ color: '#94a3b8' }} />
                    <ReferenceLine y={warnC}   stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: `${warnC}°`, position: 'right', fontSize: 7, fill: '#f59e0b' }} />
                    <ReferenceLine y={dangerC} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: `${dangerC}°`, position: 'right', fontSize: 7, fill: '#ef4444' }} />
                    <Area type="monotone" dataKey="temp" stroke="#38bdf8" fill="url(#hbTempGrad)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
