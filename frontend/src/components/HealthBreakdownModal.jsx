import { X } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import { useTempThresholds } from '../context/TempThresholdContext'

function scoreLabel(score) {
  if (score == null) return { label: 'Unknown',  color: 'var(--wt-text-faint)' }
  if (score >= 90)   return { label: 'Excellent', color: 'var(--wt-up-600)' }
  if (score >= 75)   return { label: 'Good',      color: 'var(--wt-up-500)' }
  if (score >= 60)   return { label: 'Fair',      color: 'var(--wt-warn-600)' }
  if (score >= 40)   return { label: 'Poor',      color: 'var(--wt-warn-500)' }
  return               { label: 'Critical',   color: 'var(--wt-down-500)' }
}

function recommendation(score, breakdown) {
  if (score === 0 || breakdown.some(b => b.factor === 'SMART failure'))
    return { text: 'Replace immediately — SMART failure detected', color: 'var(--wt-down-500)' }
  const hasErrors = breakdown.some(b =>
    (b.factor === 'Reallocated sectors' || b.factor === 'Pending sectors' || b.factor === 'Uncorrectable errors') && b.delta < 0
  )
  if (score < 40 || hasErrors)
    return { text: 'Replace soon — significant SMART errors or wear detected', color: 'var(--wt-down-500)' }
  if (score < 60)
    return { text: 'Replace when possible — health declining', color: 'var(--wt-warn-600)' }
  if (score < 75)
    return { text: 'Monitor closely — approaching end of expected lifespan', color: 'var(--wt-warn-600)' }
  if (score < 90)
    return { text: 'Healthy — minor wear factors present', color: 'var(--wt-up-600)' }
  return { text: 'Excellent health — no concerns', color: 'var(--wt-up-600)' }
}

const axisStyle = { fontSize: 8, fill: 'var(--wt-text-faint)' }

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
        <div className="relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
          style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>

          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--wt-border)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--wt-text)' }}>Health Breakdown</p>
              <p className="wt-mono text-xs" style={{ color: 'var(--wt-text-muted)' }}>{drive.serial}</p>
            </div>
            <button onClick={onClose}
              className="transition-colors p-1 rounded text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
              <X size={18} />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-5">

            {/* Score ring */}
            <div className="flex items-center gap-5">
              <div className="relative w-[72px] h-[72px] shrink-0">
                <svg width={72} height={72} className="-rotate-90">
                  <circle cx={36} cy={36} r={r} fill="none"
                    style={{ stroke: 'var(--wt-n-200)', strokeWidth: 5 }} />
                  <circle cx={36} cy={36} r={r} fill="none"
                    style={{ stroke: color, strokeWidth: 5, strokeDasharray: `${fill} ${circ - fill}`, strokeLinecap: 'round' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="wt-mono text-lg font-bold" style={{ color }}>{score}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold leading-tight" style={{ color }}>{scoreLabel_}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--wt-text-muted)' }}>{drive.make} {drive.model}</p>
                <p className="text-xs mt-2 font-medium" style={{ color: rec.color }}>{rec.text}</p>
              </div>
            </div>

            {/* Factor breakdown */}
            <section>
              <p className="wt-eyebrow mb-2">Score Factors</p>
              <div className="flex flex-col" style={{ borderTop: '1px solid var(--wt-border)' }}>
                {breakdown.map((b, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-2"
                    style={{ borderBottom: '1px solid var(--wt-border)' }}>
                    <div className="min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'var(--wt-text)' }}>{b.factor}</p>
                      <p className="text-[10px] leading-snug" style={{ color: 'var(--wt-text-faint)' }}>{b.detail}</p>
                    </div>
                    <span className="wt-mono text-xs font-bold shrink-0" style={{ color:
                      b.positive || b.delta === 0 ? 'var(--wt-up-500)' :
                      b.delta <= -20 ? 'var(--wt-down-500)' :
                      b.delta <= -10 ? 'var(--wt-warn-600)' :
                      'var(--wt-warn-500)'
                    }}>
                      {b.delta === 0 ? '+0' : b.delta}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--wt-text)' }}>Final Score</span>
                  <span className="wt-mono text-sm font-bold" style={{ color }}>{score} / 100</span>
                </div>
              </div>
            </section>

            {/* Temp history chart */}
            {tempHistory.length > 1 && (
              <section>
                <p className="wt-eyebrow mb-2">Temperature History ({tempHistory.length} readings)</p>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={tempHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="hbTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
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
