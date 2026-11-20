import { useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Thermometer, WifiOff, X } from 'lucide-react'
import { groupColor, poolGroups, TEMP_COLOR, tempBand } from '../../lib/fleet'
import { fmtCap, fmtTB, plural } from '../../lib/format'

// ── Temperature spread ─────────────────────────────────────────────────────

export function TempSpread({ spread, thresholds }) {
  const { bins, avg, binSize } = spread
  const top = bins.reduce((best, b) => (b.count > (best?.count ?? -1) ? b : best), null)
  const [sel, setSel] = useState(null)
  const selected = bins.find(b => b.t === sel) ?? top
  const maxCount = Math.max(1, ...bins.map(b => b.count))
  const scale = 150 / maxCount
  const avgBand = tempBand(avg, thresholds)
  const binLabel = b => (binSize === 1 ? `${b.t}°C` : `${b.t} to ${b.tMax}°C`)

  return (
    <section aria-label="Temperature spread" className="bw-card bw-card--pad flex flex-col gap-5" data-screen-label="Temperature spread">
      <div className="bw-card__head">
        <div>
          <span className="wt-eyebrow">Temperature · now</span>
          <h2 className="bw-h2 mt-1.5">Temperature spread</h2>
          <p className="bw-sub">How many drives sit at each temperature</p>
        </div>
        {avg != null && (
          <div className="flex gap-2 items-center">
            <span className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>Average</span>
            <span className={`wt-pill ${avgBand === 'warn' ? 'wt-pill--warn' : avgBand === 'down' ? 'wt-pill--down' : 'wt-pill--muted'}`}>{avg}°C</span>
          </div>
        )}
      </div>
      {bins.length === 0 ? (
        <div className="bw-note"><Thermometer size={16} aria-hidden="true" />No temperature readings from connected drives.</div>
      ) : (
        <div className="bw-spread" role="group" aria-label="Drives per temperature">
          {bins.map(b => {
            const on = selected?.t === b.t
            const h = b.count ? Math.max(10, b.count * scale) : 4
            const color = b.count ? TEMP_COLOR[tempBand(b.t, thresholds)] : 'var(--wt-border)'
            return (
              <div key={b.t} className="bw-spread__col">
                {on && b.count > 0 && (
                  <div className="bw-spread__tip" style={{ bottom: `calc(${h}px + 30px)` }} role="tooltip">
                    <b className="wt-mono" style={{ fontWeight: 600 }}>{plural(b.count, 'drive')}</b> at {binLabel(b)}
                    <span className="block" style={{ color: 'var(--wt-console-muted)' }}>
                      {b.labels.slice(0, 6).join(', ')}{b.labels.length > 6 ? ` +${b.labels.length - 6}` : ''}
                    </span>
                  </div>
                )}
                <button type="button" className="bw-spread__bar" aria-pressed={on}
                  aria-label={`${plural(b.count, 'drive')} at ${binLabel(b)}`}
                  onClick={() => setSel(b.t)}
                  style={{ height: h, background: color, opacity: on || !b.count ? 1 : 0.55, outlineOffset: 3 }} />
                <span className="bw-spread__axis">{b.t}°</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Needs attention ────────────────────────────────────────────────────────

const ICONS = { damaged: X, failing: X, errors: AlertTriangle, realloc: AlertTriangle, hot: Thermometer, offline: WifiOff }

export function NeedsAttention({ items, total, onOpen, compact }) {
  return (
    <section aria-label="Needs attention" className="bw-card bw-card--pad" data-screen-label="Needs attention">
      <div className="flex justify-between items-center mb-2">
        <h2 className="bw-h2">Needs attention</h2>
        {items.length > 0
          ? <span className={`wt-pill ${items.some(i => i.tone === 'down') ? 'wt-pill--solid-down' : 'wt-pill--warn'}`}>{items.length}</span>
          : <span className="wt-pill wt-pill--up"><span className="wt-pill__dot" aria-hidden="true" />All clear</span>}
      </div>
      {items.length > 0 ? (
        <div>
          {items.map(it => {
            const Icon = ICONS[it.id] || AlertTriangle
            return (
              <button key={it.id} type="button" className="bw-row" onClick={() => onOpen(it)}>
                <span className={`bw-chipicon bw-chipicon--${it.tone === 'muted' ? '' : it.tone}`} style={{ width: 40, height: 40 }}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="bw-row__title">{it.title}</span>
                  <span className="bw-row__detail truncate">{it.detail}</span>
                </span>
                <ChevronRight size={16} aria-hidden="true" style={{ color: 'var(--wt-text-faint)' }} />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center gap-3 pt-4 pb-2">
          {!compact && (
            <svg width="112" height="112" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="56" fill="var(--wt-up-50)" />
              <circle cx="60" cy="60" r="40" fill="none" stroke="var(--wt-up-500)" strokeOpacity="0.25" strokeWidth="1.5" />
              <circle cx="60" cy="60" r="26" fill="var(--wt-up-500)" />
              <path d="m48 61 8 8 17-18" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
          <div className="font-bold" style={{ fontSize: 'var(--wt-text-md)' }}>Nothing needs attention</div>
          <div className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>
            All {plural(total, 'drive')} pass SMART, every bay is operational, and no sectors have been reallocated.
          </div>
        </div>
      )}
    </section>
  )
}

/** Mobile banner version of Needs attention. */
export function AttentionBanner({ items, onOpen }) {
  if (!items.length) {
    return (
      <div className="bw-note" style={{ background: 'var(--wt-up-50)', color: 'var(--wt-up-700)', minHeight: 48 }}>
        <Check size={18} aria-hidden="true" />
        <span className="flex-1 font-semibold">All clear</span>
        <span className="text-[13px]">Nothing needs attention</span>
      </div>
    )
  }
  const loud = items.some(i => i.urgent)
  return (
    <button type="button" onClick={() => onOpen(items[0])} className="bw-note w-full text-left"
      style={{
        minHeight: 48, cursor: 'pointer',
        background: loud ? 'var(--wt-down-50)' : 'var(--wt-warn-50)',
        color: loud ? 'var(--wt-down-700)' : 'var(--wt-warn-700)',
        border: `1px solid ${loud ? 'var(--wt-down-500)' : 'var(--wt-warn-100)'}`,
      }}>
      <AlertTriangle size={18} aria-hidden="true" />
      <span className="font-semibold whitespace-nowrap">{plural(items.length, 'item')} {items.length === 1 ? 'needs' : 'need'} attention</span>
      <span className="flex-1 min-w-0 text-[13px] truncate text-right">{items[0].title}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  )
}

// ── Pool capacity ──────────────────────────────────────────────────────────

function capTone(pct) {
  return pct >= 90 ? 'down' : pct >= 80 ? 'warn' : null
}

export function PoolCapacity({ pools, drives, bayBySerial, groups: fleetGroups }) {
  if (!pools.length) return null
  const main = [...pools].sort((a, b) => b.size_bytes - a.size_bytes)[0]
  const others = pools.filter(p => p !== main)
  const tone = capTone(main.capacity_pct)
  const ringColor = tone ? `var(--wt-${tone}-500)` : 'var(--wt-viz-1)'
  const r = 48, circ = 2 * Math.PI * r
  const inPool = drives.filter(d => d.zfs_pool === main.name)
  const local = poolGroups(inPool, bayBySerial)
  const groups = local.map(g => ({ ...g, color: fleetGroups ? groupColor(fleetGroups, g.key) : g.color }))
  const maxG = Math.max(1, ...groups.map(g => g.count))

  return (
    <section aria-label="Pool capacity" className="bw-card bw-card--pad" data-screen-label="Pool capacity">
      <span className="wt-eyebrow">ZFS · {main.name}</span>
      <h2 className="bw-h2 mt-1.5 mb-4">Pool capacity</h2>
      <div className="flex items-center gap-5">
        <svg role="img" aria-label={`${main.capacity_pct} percent of ${main.name} used`} width="128" height="128" viewBox="0 0 120 120" style={{ flex: 'none' }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--wt-n-150)" strokeWidth="14" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={ringColor} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${((main.capacity_pct / 100) * circ).toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 60 60)" />
          <text x="60" y="64" textAnchor="middle" fontSize="24" fontWeight="600" fill="var(--wt-text)" fontFamily="var(--wt-font-mono)" letterSpacing="-1">{main.capacity_pct}%</text>
          <text x="60" y="81" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--wt-text-subtle)" fontFamily="var(--wt-font-mono)" letterSpacing="1">USED</text>
        </svg>
        <div className="flex-1 flex flex-col gap-3 text-[13px]">
          {[['Used', main.alloc_bytes, ringColor], ['Free', main.free_bytes, 'var(--wt-n-200)'], ['Usable', main.size_bytes, 'var(--wt-text)']].map(([k, v, c]) => (
            <div key={k} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} aria-hidden="true" />
              <span className="flex-1" style={{ color: 'var(--wt-text-muted)' }}>{k}</span>
              <b className="wt-mono" style={{ fontWeight: 600 }}>{fmtTB(v)}</b>
            </div>
          ))}
        </div>
      </div>
      {groups.length > 0 && (
        <div className="mt-5 pt-4 flex flex-col gap-2.5" style={{ borderTop: '1px solid var(--wt-border)' }}>
          <div className="text-[13px] font-bold">Drives per group</div>
          {groups.map(g => (
            <div key={g.key} className="flex items-center gap-3 text-[13px]">
              <span className="wt-mono truncate" style={{ width: 84, color: 'var(--wt-text-muted)', fontSize: 12 }}>{g.label}</span>
              <div className="flex-1 wt-meter" style={{ height: 8 }}>
                <div className="wt-meter__fill" style={{ width: `${(g.count / maxG) * 100}%`, background: groupColor(groups, g.key) }} />
              </div>
              <b className="wt-mono w-6 text-right" style={{ fontWeight: 600 }}>{g.count}</b>
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-5 pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--wt-border)' }}>
          {others.map(p => {
            const t = capTone(p.capacity_pct)
            return (
              <div key={p.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold">{p.name}</span>
                  <span className="wt-mono" style={{ color: 'var(--wt-text-muted)' }}>{p.capacity_pct}% of {fmtCap(p.size_bytes)}</span>
                </div>
                <div className="wt-meter"><div className="wt-meter__fill" style={{ width: `${p.capacity_pct}%`, background: t ? `var(--wt-${t}-500)` : 'var(--wt-viz-1)' }} /></div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
