import { useMemo, useRef, useState } from 'react'
import { Check, Search, Undo2 } from 'lucide-react'
import { assignDrive, unassignDrive } from '../api/client'
import { bayLabel, placeableBays, unplacedDrives } from '../lib/fleet'
import { driveName, fmtAge, fmtCap, plural } from '../lib/format'
import Dialog from './ui/Dialog'

function Hl({ text, q }) {
  const s = String(text ?? '')
  const i = q ? s.toLowerCase().indexOf(q) : -1
  if (i < 0) return s
  return <>{s.slice(0, i)}<mark className="bw-hl">{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>
}

/** Small map of one array with the bay being filled highlighted. */
function BayMap({ array, bays, currentId, placedIds }) {
  const grid = Array.from({ length: array.rows * array.cols }, () => null)
  for (const b of bays) if (b.row < array.rows && b.col < array.cols) grid[b.row * array.cols + b.col] = b
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${array.cols}, minmax(0, 1fr))`, maxWidth: Math.min(360, array.cols * 72) }}
      role="img" aria-label={`${array.name}: bay ${bayLabel(bays.find(b => b.id === currentId))} highlighted`}>
      {grid.map((b, i) => {
        if (!b) return <div key={i} />
        const cur = b.id === currentId
        const filled = b.drive_serial || placedIds.has(b.id)
        const damaged = b.status === 'damaged'
        return (
          <div key={b.id} className="wt-mono text-[10.5px] flex items-center justify-center rounded" style={{
            height: 22,
            background: cur ? 'var(--bw-ink)' : filled ? 'var(--wt-surface-3)' : 'transparent',
            color: cur ? 'var(--wt-surface)' : 'var(--wt-text-subtle)',
            border: `1px ${filled || cur ? 'solid' : 'dashed'} ${cur ? 'var(--bw-ink)' : damaged ? 'var(--wt-down-500)' : 'var(--wt-border-strong)'}`,
            fontWeight: cur ? 700 : 500,
          }}>{bayLabel(b)}</div>
        )
      })}
    </div>
  )
}

/**
 * Walks the empty bays of a location one by one so a whole chassis can be mapped quickly:
 * read the serial off the caddy, type part of it, pick the drive, move on.
 */
export default function PlaceDrivesSheet({ locations, startLocationId, drives, placement, onClose, onSaved }) {
  const candidates = locations.filter(l => !l.remote && placeableBays(l).length)
  const [locId, setLocId] = useState(
    candidates.find(l => l.id === startLocationId)?.id ?? candidates[0]?.id ?? null,
  )
  const loc = candidates.find(l => l.id === locId)
  // Snapshot the queue when the location is chosen; placements below don't reshuffle it.
  const queue = useMemo(() => placeableBays(loc), [loc?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0)
  const [q, setQ] = useState('')
  const [placed, setPlaced] = useState([]) // [{ bayId, serial, label, name }]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const searchRef = useRef(null)

  const placedSerials = new Set(placed.map(p => p.serial))
  const placedBayIds = new Set(placed.map(p => p.bayId))
  const pool = unplacedDrives(drives, placement).filter(d => !placedSerials.has(d.serial))
  const needle = q.trim().toLowerCase()
  const shown = needle
    ? pool.filter(d => [d.serial, driveName(d), d.device_path, d.zfs_pool].filter(Boolean).join(' ').toLowerCase().includes(needle))
    : pool
  const current = queue[idx]
  const done = !current || pool.length === 0

  function next() {
    setIdx(i => i + 1)
    setQ('')
    setError(null)
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  async function place(d) {
    setBusy(true); setError(null)
    try {
      await assignDrive(current.bay.id, d.serial)
      setPlaced(p => [...p, { bayId: current.bay.id, serial: d.serial, label: bayLabel(current.bay), name: driveName(d) }])
      next()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not place the drive. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    const last = placed[placed.length - 1]
    if (!last) return
    setBusy(true); setError(null)
    try {
      await unassignDrive(last.bayId)
      setPlaced(p => p.slice(0, -1))
      const back = queue.findIndex(x => x.bay.id === last.bayId)
      setIdx(back >= 0 ? back : idx)
      setQ('')
    } catch {
      setError('Could not undo. Check the connection.')
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    if (placed.length) await onSaved?.()
    onClose()
  }

  const last = placed[placed.length - 1]
  const arrayEntry = current && loc.arrays.find(a => a.array.id === current.array.id)

  return (
    <Dialog
      title="Place drives"
      subtitle={loc
        ? `${loc.name}: ${plural(pool.length, 'drive')} to place, ${plural(Math.max(0, queue.length - idx), 'empty bay')} left`
        : 'Nothing to place'}
      onClose={finish}
      width={560}
      footer={(
        <div className="flex flex-col gap-3">
          {error && <div className="wt-pill wt-pill--down" role="alert" style={{ borderRadius: 'var(--wt-r-md)', padding: '8px 12px' }}>{error}</div>}
          <div className="flex gap-2.5">
            {!done && (
              <button type="button" className="wt-btn wt-btn--secondary bw-btn-lg flex-1 justify-center" onClick={next} disabled={busy}>
                Skip bay {bayLabel(current.bay)}
              </button>
            )}
            <button type="button" className="wt-btn wt-btn--primary bw-btn-lg justify-center" style={{ flex: done ? 1 : 1.2 }} onClick={finish} disabled={busy}>
              Done{placed.length ? `, ${plural(placed.length, 'drive')} placed` : ''}
            </button>
          </div>
        </div>
      )}
    >
      {candidates.length > 1 && (
        <label className="wt-field">
          <span className="wt-label">Location</span>
          <select className="wt-select" value={locId ?? ''} disabled={placed.length > 0}
            onChange={e => { setLocId(e.target.value); setIdx(0); setQ('') }}>
            {candidates.map(l => <option key={l.id} value={l.id}>{l.name} ({plural(placeableBays(l).length, 'empty bay')})</option>)}
          </select>
        </label>
      )}

      {last && (
        <div className="bw-note" role="status" style={{ background: 'var(--wt-up-50)', color: 'var(--wt-up-700)' }}>
          <Check size={16} aria-hidden="true" />
          <span className="flex-1 min-w-0 truncate">Placed {last.name} in bay <span className="wt-mono">{last.label}</span></span>
          <button type="button" className="inline-flex items-center gap-1 font-semibold" style={{ minHeight: 32 }} onClick={undo} disabled={busy}>
            <Undo2 size={14} aria-hidden="true" />Undo
          </button>
        </div>
      )}

      {done ? (
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <span className="bw-chipicon bw-chipicon--up" style={{ width: 48, height: 48 }}><Check size={22} aria-hidden="true" /></span>
          <div className="font-bold" style={{ fontSize: 'var(--wt-text-md)' }}>
            {pool.length === 0 ? 'Every drive has a bay' : 'No more empty bays here'}
          </div>
          <p className="bw-sub">
            {pool.length === 0
              ? `${plural(placed.length, 'drive')} placed this time.`
              : `${plural(pool.length, 'drive')} still need a bay. ${candidates.length > 1 ? 'Pick another location above, or add' : 'Add'} a computer or shelf in Settings.`}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-0">
              <span className="wt-eyebrow">{current.array.name}</span>
              <div className="bw-metric mt-1" style={{ fontSize: 'var(--wt-text-2xl)' }}>Bay {bayLabel(current.bay)}</div>
              <p className="bw-sub">Which drive is in this bay?</p>
            </div>
            {arrayEntry && <div className="flex-1" style={{ minWidth: 180 }}><BayMap array={arrayEntry.array} bays={arrayEntry.bays} currentId={current.bay.id} placedIds={placedBayIds} /></div>}
          </div>

          <label className="bw-search" style={{ background: 'var(--wt-surface)', borderColor: 'var(--wt-border-strong)', color: 'var(--wt-text-subtle)' }}>
            <Search size={16} aria-hidden="true" />
            <span className="sr-only-bw">Filter drives by serial or model</span>
            <input ref={searchRef} data-autofocus type="search" value={q} placeholder="Type part of the serial on the drive label"
              style={{ color: 'var(--wt-text)' }} autoComplete="off" onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && shown.length === 1 && !busy) place(shown[0]) }} />
          </label>

          <div className="flex flex-col" style={{ maxHeight: 300, overflowY: 'auto' }} aria-label="Drives not in a bay">
            {shown.map((d, i) => (
              <button key={d.serial} type="button" className="bw-row" style={i === 0 ? { borderTop: 0 } : undefined} disabled={busy} onClick={() => place(d)}>
                <span className="flex-1 min-w-0">
                  <span className="bw-row__title truncate"><Hl text={driveName(d)} q={needle} /></span>
                  <span className="bw-row__detail wt-mono truncate"><Hl text={d.serial} q={needle} />{d.device_path ? ` · ${d.device_path}` : ''}</span>
                </span>
                <span className="wt-mono text-xs text-right shrink-0" style={{ color: 'var(--wt-text-muted)' }}>
                  {fmtCap(d.capacity_bytes)}<br />{fmtAge(d.power_on_hours)}
                </span>
                {d.is_connected === false && <span className="wt-pill wt-pill--muted">Offline</span>}
              </button>
            ))}
            {!shown.length && <p className="bw-sub py-4 text-center">No unplaced drive matches “{q.trim()}”.</p>}
          </div>
          {shown.length === 1 && needle && <p className="wt-hint">Press Enter to place it.</p>}
        </>
      )}
    </Dialog>
  )
}
