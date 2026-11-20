import { Download } from 'lucide-react'
import { gaugeSegments } from '../../lib/fleet'
import { fmtRelative, plural } from '../../lib/format'
import { ScanButton } from '../shell/AppHeader'

const SEG_FILL = {
  up: 'var(--wt-up-500)',
  warn: 'var(--wt-warn-500)',
  down: 'var(--wt-down-500)',
  muted: 'var(--wt-console-border)',
}

export function FleetGauge({ drives, summary, compact = false }) {
  const segs = gaugeSegments(drives)
  const aria = summary.total
    ? `${summary.passed} of ${plural(summary.total, 'drive')} passed SMART`
    : 'No drives'
  return (
    <svg role="img" aria-label={aria} viewBox="0 0 400 215" width="100%" className="bw-gauge" style={{ maxWidth: compact ? 300 : 420, display: 'block' }}>
      {segs.length === 0 && (
        <path d="M28 190 A172 172 0 0 1 372 190 L328 190 A128 128 0 0 0 72 190 Z" fill="var(--wt-console-border)" />
      )}
      {segs.map(s => <path key={s.serial} d={s.d} fill={SEG_FILL[s.status]} />)}
      <text x="200" y="166" textAnchor="middle" fontSize="58" fontWeight="600" fill="var(--wt-console-text)"
        fontFamily="var(--wt-font-mono)" letterSpacing="-2">
        {summary.total ? `${summary.pct}%` : '—'}
      </text>
      <text x="200" y="198" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--wt-console-muted)"
        fontFamily="var(--wt-font-mono)" letterSpacing="1.4">
        PASSED SMART
      </text>
    </svg>
  )
}

function GaugePills({ summary }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 bw-hero__pills">
      <span className="bw-band-pill bw-band-pill--up">{summary.up} healthy</span>
      {summary.warn > 0 && <span className="bw-band-pill bw-band-pill--warn">{summary.warn} degraded</span>}
      {summary.down > 0 && <span className="bw-band-pill bw-band-pill--down">{summary.down} failing</span>}
      {summary.offline > 0 && <span className="bw-band-pill">{summary.offline} disconnected</span>}
      {summary.muted - summary.offline > 0 && <span className="bw-band-pill">{summary.muted - summary.offline} unknown</span>}
    </div>
  )
}

export default function Hero({ copy, summary, drives, location, lastRefreshed, onExport }) {
  const worst = summary.down ? 'down' : summary.warn ? 'warn' : 'up'
  return (
    <div className="bw-hero">
      <div className="bw-hero__copy">
        {location && (
          <span className="bw-live" style={{ alignSelf: 'flex-start' }}>
            <span className={`bw-live__dot ${worst !== 'up' ? `bw-live__dot--${worst}` : ''}`} aria-hidden="true" />
            {location.name}, {location.kind === 'shelf' ? 'shelf' : location.kind === 'remote' ? 'remote' : 'server'}
            {lastRefreshed && <>. Updated {fmtRelative(lastRefreshed)}</>}
          </span>
        )}
        <h1 className="bw-hero__title">{copy.title}</h1>
        <p className="bw-hero__sub">{copy.sub}</p>
        <div className="flex flex-wrap gap-3 mt-1 bw-desktop-only">
          <ScanButton large />
          <button type="button" className="wt-btn bw-btn-band bw-btn-lg" onClick={onExport} disabled={!drives.length}>
            <Download size={16} aria-hidden="true" /> Export
          </button>
        </div>
      </div>
      <div className="bw-hero__gauge">
        <FleetGauge drives={drives} summary={summary} />
        <GaugePills summary={summary} />
      </div>
    </div>
  )
}
