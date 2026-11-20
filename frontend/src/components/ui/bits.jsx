// Small shared presentational pieces built on Watchtower classes.
import { driveStatus, driveStatusLabel } from '../../lib/fleet'

const PILL_CLASS = { up: 'wt-pill--up', warn: 'wt-pill--warn', down: 'wt-pill--solid-down', muted: 'wt-pill--muted' }

/** Drive status pill. Down is the loudest the UI gets: a solid red pill. */
export function StatusPill({ drive, status, label }) {
  const s = status ?? driveStatus(drive)
  return (
    <span className={`wt-pill ${PILL_CLASS[s]}`}>
      {s !== 'down' && <span className="wt-pill__dot" aria-hidden="true" />}
      {label ?? driveStatusLabel(drive)}
    </span>
  )
}

/** SMART status word in mono. */
export function SmartPill({ status }) {
  const s = status === 'PASSED' ? 'up' : status === 'FAILED' ? 'down' : 'muted'
  const label = status === 'PASSED' ? 'Passed' : status === 'FAILED' ? 'Failed' : 'Unknown'
  return <span className={`wt-pill ${PILL_CLASS[s]}`}>{label}</span>
}

export const STATUS_COLOR = {
  up: 'var(--wt-up-500)', warn: 'var(--wt-warn-500)', down: 'var(--wt-down-500)', muted: 'var(--wt-n-400)',
}

export function Led({ status, color, hollow }) {
  return (
    <span
      className={`bw-led ${hollow ? 'bw-led--hollow' : ''}`}
      style={hollow ? undefined : { background: color ?? STATUS_COLOR[status], boxShadow: `0 0 0 3px color-mix(in oklch, ${color ?? STATUS_COLOR[status]} 22%, transparent)` }}
      aria-hidden="true"
    />
  )
}

/** Compact line chart for 30-day temperatures. `refLine` draws the warning threshold. */
export function Sparkline({ values, height = 72, color = 'var(--wt-viz-1)', refLine, label, min: minProp, max: maxProp, fill = true }) {
  const pts = values.filter(v => v != null)
  if (pts.length < 2) {
    return <div className="bw-note" style={{ height, justifyContent: 'center' }}>Not enough history yet</div>
  }
  const W = 300
  const lo = Math.min(minProp ?? Infinity, ...pts, refLine ?? Infinity) - 1
  const hi = Math.max(maxProp ?? -Infinity, ...pts, refLine ?? -Infinity) + 1
  const y = v => (height - 6 - ((v - lo) / (hi - lo)) * (height - 12)).toFixed(1)
  const x = i => ((i / (pts.length - 1)) * W).toFixed(1)
  const line = pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      {refLine != null && (
        <line x1="0" x2={W} y1={y(refLine)} y2={y(refLine)} stroke="var(--wt-warn-500)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      )}
      {fill && <polygon points={`0,${height} ${line} ${W},${height}`} fill={color} opacity="0.12" />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Health score ring (0–100). Colour follows the score's meaning, not decoration. */
export function HealthRing({ score, size = 84, onClick }) {
  const r = 26, circ = 2 * Math.PI * r
  const color = score == null ? 'var(--wt-n-400)' : score >= 75 ? 'var(--wt-up-500)' : score >= 40 ? 'var(--wt-warn-500)' : 'var(--wt-down-500)'
  const body = (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="bw-ring">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--wt-n-150)" strokeWidth="6" />
      {score != null && (
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${((score / 100) * circ).toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 32 32)" />
      )}
      <text x="32" y="37.5" textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--wt-text)">{score ?? '?'}</text>
    </svg>
  )
  if (!onClick) return body
  return (
    <button type="button" onClick={onClick} aria-label={`Health score ${score ?? 'unknown'}, show breakdown`} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', borderRadius: '50%' }}>
      {body}
    </button>
  )
}

export function Kv({ k, v, mono }) {
  return (
    <div className="bw-kv">
      <span>{k}</span>
      <span className={mono ? 'wt-mono' : undefined}>{v}</span>
    </div>
  )
}

export function Stat({ label, value, unit, tone }) {
  return (
    <div className="bw-stat">
      <div className="bw-stat__label">{label}</div>
      <div className="bw-metric bw-stat__value" style={tone ? { color: `var(--wt-${tone}-600)` } : undefined}>
        {value}{unit && <small>{unit}</small>}
      </div>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" style={{ color: 'var(--wt-text-faint)' }} role="status">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--wt-n-150)', borderTopColor: 'var(--bw-ink)' }} />
      <span className="text-sm">{label}</span>
    </div>
  )
}
