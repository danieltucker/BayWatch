import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Database, HardDrive } from 'lucide-react'
import AppHeader from '../components/shell/AppHeader'
import { Spinner } from '../components/ui/bits'
import { useFleet } from '../context/FleetContext'
import { bayLabel, driveStatus, placementLabel } from '../lib/fleet'
import { driveName, fmtAge, fmtTB, plural } from '../lib/format'

/** Split text around the first case-insensitive match of q. */
function Hl({ text, q }) {
  const s = String(text ?? '')
  const i = q ? s.toLowerCase().indexOf(q) : -1
  if (i < 0) return s
  return <>{s.slice(0, i)}<mark className="bw-hl">{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>
}

export default function SearchPage() {
  const fleet = useFleet()
  const [params, setParams] = useSearchParams()
  const raw = params.get('q') || ''
  const q = raw.trim().toLowerCase()
  const tab = ['drives', 'pools'].includes(params.get('type')) ? params.get('type') : 'all'
  const setQ = v => setParams(p => { const n = new URLSearchParams(p); if (v) n.set('q', v); else n.delete('q'); n.delete('type'); return n }, { replace: true })
  const setTab = t => setParams(p => { const n = new URLSearchParams(p); if (t === 'all') n.delete('type'); else n.set('type', t); return n }, { replace: true })

  const { drives, placement, pools, locations } = fleet

  const driveHits = useMemo(() => !q ? [] : drives.filter(d =>
    [driveName(d), d.serial, d.device_path, d.zfs_pool, d.vdev_name, placementLabel(placement[d.serial])]
      .filter(Boolean).join(' ').toLowerCase().includes(q)), [drives, placement, q])

  const poolHits = useMemo(() => {
    if (!q) return []
    const names = new Set([...pools.map(p => p.name), ...drives.map(d => d.zfs_pool).filter(Boolean)])
    return [...names].filter(n => n.toLowerCase().includes(q)).map(n => {
      const p = pools.find(x => x.name === n)
      const count = drives.filter(d => d.zfs_pool === n).length
      return { name: n, sub: [plural(count, 'drive'), p ? `${p.capacity_pct}% of ${fmtTB(p.size_bytes)} used` : null].filter(Boolean).join(', ') }
    })
  }, [pools, drives, q])

  const total = driveHits.length + poolHits.length
  const hitSerials = new Set(driveHits.map(d => d.serial))

  // Map: the local location with the most matches (or the first one).
  const local = locations.filter(l => !l.remote)
  const counts = local.map(l => ({ l, n: driveHits.filter(d => placement[d.serial]?.location.id === l.id).length }))
  const mapLoc = (counts.sort((a, b) => b.n - a.n)[0] || {}).l
  const mapArray = mapLoc ? [...mapLoc.arrays].sort((a, b) => b.bays.length - a.bays.length)[0] : null
  const elsewhere = driveHits.filter(d => placement[d.serial] && placement[d.serial].location.id !== mapLoc?.id)
  const unplaced = driveHits.filter(d => !placement[d.serial])

  const suggestions = useMemo(() => {
    const out = []
    const d0 = drives[0]
    if (d0) out.push(d0.serial)
    const model = drives.find(d => d.model)?.model
    if (model) out.push(model.split(/\s+/)[0])
    if (pools[0]) out.push(pools[0].name)
    const p0 = Object.values(placement)[0]
    if (p0) out.push(bayLabel(p0.bay))
    return [...new Set(out)]
  }, [drives, pools, placement])

  return (
    <div className="bw-page" data-screen-label="Search">
      <AppHeader search={{ value: raw, onChange: setQ }} />
      {fleet.loading ? <Spinner /> : (
        <div className="bw-split" style={{ gridTemplateColumns: undefined }}>
          <div className="bw-stack" style={{ gap: 'var(--wt-4)' }}>
            {q ? (
              <>
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <h1 className="font-bold" style={{ fontSize: 'var(--wt-text-md)' }} aria-live="polite">
                    <span className="wt-mono">{total}</span> {total === 1 ? 'result' : 'results'} for “{raw.trim()}”
                  </h1>
                  <div role="group" aria-label="Result type" className="flex gap-1.5">
                    {[['all', 'All', total], ['drives', 'Drives', driveHits.length], ['pools', 'Pools', poolHits.length]].map(([k, l, n]) => (
                      <button key={k} type="button" className="bw-chipbtn" aria-pressed={tab === k} onClick={() => setTab(k)}>{l} <span className="wt-mono">{n}</span></button>
                    ))}
                  </div>
                </div>
                {driveHits.length > 0 && tab !== 'pools' && (
                  <section aria-label="Drive results" className="bw-card" style={{ padding: '0 var(--wt-5)' }}>
                    <div className="wt-eyebrow" style={{ padding: '14px 0 12px' }}>Drives</div>
                    {driveHits.map(d => {
                      const p = placement[d.serial]
                      const st = driveStatus(d)
                      return (
                        <Link key={d.serial} to={`/drives/${encodeURIComponent(d.serial)}`} className="bw-row" style={{ gap: 'var(--wt-4)' }}>
                          <span className={`bw-chipicon ${st === 'up' ? 'bw-chipicon--up' : st === 'warn' ? 'bw-chipicon--warn' : st === 'down' ? 'bw-chipicon--down' : ''}`} style={{ width: 40, height: 40 }}>
                            <HardDrive size={17} aria-hidden="true" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="bw-row__title truncate" style={{ fontSize: 'var(--wt-text-base)', fontWeight: 600 }}><Hl text={driveName(d)} q={q} /></span>
                            <span className="bw-row__detail truncate">
                              <span className="wt-mono"><Hl text={d.serial} q={q} /></span> · {p ? <Hl text={placementLabel(p)} q={q} /> : 'Not in a bay'}
                            </span>
                          </span>
                          {d.is_connected === false && <span className="wt-pill wt-pill--muted">Disconnected</span>}
                          <span className="wt-mono text-[13px] text-right shrink-0 bw-desktop-only" style={{ color: 'var(--wt-text-muted)', width: 100 }}>
                            {d.is_connected === false ? fmtAge(d.power_on_hours) : `${d.temperature_c ?? '—'}°C, ${fmtAge(d.power_on_hours)}`}
                          </span>
                        </Link>
                      )
                    })}
                  </section>
                )}
                {poolHits.length > 0 && tab !== 'drives' && (
                  <section aria-label="Pool results" className="bw-card" style={{ padding: '0 var(--wt-5)' }}>
                    <div className="wt-eyebrow" style={{ padding: '14px 0 12px' }}>Pools</div>
                    {poolHits.map(p => (
                      <Link key={p.name} to={`/drives?q=${encodeURIComponent(p.name)}`} className="bw-row" style={{ gap: 'var(--wt-4)' }}>
                        <span className="bw-chipicon bw-chipicon--ink" style={{ width: 40, height: 40 }}><Database size={17} aria-hidden="true" /></span>
                        <span className="flex-1 min-w-0">
                          <span className="bw-row__title" style={{ fontSize: 'var(--wt-text-base)', fontWeight: 600 }}><Hl text={p.name} q={q} /></span>
                          <span className="bw-row__detail">{p.sub}</span>
                        </span>
                      </Link>
                    ))}
                  </section>
                )}
                {total === 0 && (
                  <div className="bw-card bw-card--pad text-center py-12">
                    <div className="font-semibold" style={{ fontSize: 'var(--wt-text-md)' }}>No matches for “{raw.trim()}”</div>
                    <div className="bw-sub mt-1">Try a serial number, model, a bay like {suggestions.find(s => /^\d+-\d+$/.test(s)) || '1-1'}, or a pool name.</div>
                  </div>
                )}
              </>
            ) : (
              <div className="bw-card bw-card--pad flex flex-col gap-3">
                <h1 className="font-bold" style={{ fontSize: 'var(--wt-text-md)' }}>Search your drives</h1>
                <p className="bw-sub">Find a drive by serial number, model, bay or pool.</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button key={s} type="button" className="bw-chipbtn wt-mono" style={{ fontFamily: 'var(--wt-font-mono)', fontWeight: 500 }} onClick={() => setQ(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {mapArray && (
            <aside aria-label="Where the matches are" className="bw-card bw-card--pad flex flex-col gap-4" data-screen-label="Where they are">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Where they are</span>
                <span className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>{mapLoc.name} · {mapArray.array.name}</span>
              </div>
              {(() => {
                const { array, bays } = mapArray
                const grid = Array.from({ length: array.rows * array.cols }, () => null)
                for (const b of bays) if (b.row < array.rows && b.col < array.cols) grid[b.row * array.cols + b.col] = b
                const n = bays.filter(b => hitSerials.has(b.drive_serial)).length
                return (
                  <div role="img" aria-label={`${plural(n, 'matching bay')} in ${mapLoc.name}`}
                    className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${array.cols}, minmax(0, 1fr))` }}>
                    {grid.map((b, i) => {
                      if (!b) return <div key={i} />
                      const hit = hitSerials.has(b.drive_serial)
                      return (
                        <div key={b.id} className="wt-mono text-[11px] flex items-center justify-center rounded-md" style={{
                          height: 30,
                          background: hit ? 'var(--bw-ink)' : b.drive_serial ? 'var(--wt-surface-2)' : 'transparent',
                          color: hit ? 'var(--wt-surface)' : 'var(--wt-text-subtle)',
                          border: `1px ${b.drive_serial || hit ? 'solid' : 'dashed'} ${hit ? 'var(--bw-ink)' : 'var(--wt-border)'}`,
                          fontWeight: hit ? 700 : 500,
                        }}>{bayLabel(b)}</div>
                      )
                    })}
                  </div>
                )
              })()}
              <div className="bw-legend">
                <span><i style={{ background: 'var(--bw-ink)', borderRadius: 3 }} />Match</span>
                <span><i style={{ background: 'var(--wt-surface-2)', border: '1px solid var(--wt-border)', borderRadius: 3 }} />Other drive</span>
              </div>
              <div className="pt-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--wt-border)' }}>
                <div className="text-[13px] font-semibold">Elsewhere</div>
                <div className="text-[13px]" style={{ color: 'var(--wt-text-muted)' }}>
                  {elsewhere.length || unplaced.length
                    ? [
                        ...Object.values(elsewhere.reduce((acc, d) => {
                          const p = placement[d.serial]
                          const g = (acc[p.location.id] ||= { name: p.location.name, labels: [], off: true })
                          g.labels.push(bayLabel(p.bay))
                          g.off = g.off && d.is_connected === false
                          return acc
                        }, {})).map(g => `${g.name}${g.off ? ', disconnected' : ''}: ${g.labels.join(', ')}`),
                        ...(unplaced.length ? [`${plural(unplaced.length, 'drive')} not in a bay`] : []),
                      ].map(line => <div key={line}>{line}</div>)
                    : 'No matches in other enclosures.'}
                </div>
              </div>
              <Link to={`/?loc=${mapLoc.id}`} className="wt-btn wt-btn--secondary bw-btn-lg justify-center">Open in Bays</Link>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
