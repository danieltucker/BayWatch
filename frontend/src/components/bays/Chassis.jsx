import { Globe, Plus } from 'lucide-react'
import {
  bayLabel, bayState, driveStatus, driveStatusLabel, GROUP_TYPE_LABEL, groupColor, isSpare,
  poolGroupKey, STATUS_LABEL, TEMP_COLOR, tempBand, tempLegend,
} from '../../lib/fleet'
import { driveName, fmtAge, fmtCap, plural } from '../../lib/format'
import { Led, SmartPill, STATUS_COLOR } from '../ui/bits'

export const COLOR_OPTS = [['health', 'Health'], ['temp', 'Temp'], ['pool', 'Pool group']]
export const DENSITY_OPTS = [['compact', 'Compact'], ['comfortable', 'Comfortable']]

export function matchesQuery(q, bay, drive, extra = '') {
  if (!q) return true
  const hay = [bayLabel(bay), drive?.make, drive?.model, drive?.serial, drive?.device_path, drive?.vdev_name, drive?.zfs_pool, extra]
    .filter(Boolean).join(' ').toLowerCase()
  return hay.includes(q)
}

export function LocationSwitcher({ locations, activeId, onPick, onAdd }) {
  return (
    <div role="group" aria-label="Location" className="bw-locs">
      {locations.map(l => (
        <button key={l.id} type="button" className="bw-loc" aria-pressed={l.id === activeId} onClick={() => onPick(l.id)}>
          <span className="bw-loc__name">
            {l.remote && <Globe size={13} aria-hidden="true" style={{ color: 'var(--wt-text-subtle)' }} />}
            {l.name}
            {l.offline && <span className="wt-pill wt-pill--muted" style={{ padding: '1px 7px', fontSize: 10.5 }}>Offline</span>}
          </span>
          <span className="bw-loc__sub">{l.sub}</span>
        </button>
      ))}
      {onAdd && (
        <button type="button" className="bw-loc bw-loc--add" onClick={onAdd}>
          <span className="inline-flex items-center gap-1.5"><Plus size={14} aria-hidden="true" />Computer or shelf</span>
        </button>
      )}
    </div>
  )
}

function legendFor(colorBy, { groups, thresholds, hasDamaged, hasSpare }) {
  if (colorBy === 'temp') return tempLegend(thresholds)
  if (colorBy === 'pool') return groups.length ? groups.map(g => ({ color: g.color, label: g.label })) : [{ color: 'var(--wt-n-300)', label: 'Not in a pool' }]
  const out = [
    { color: STATUS_COLOR.up, label: STATUS_LABEL.up },
    { color: STATUS_COLOR.warn, label: STATUS_LABEL.warn },
    { color: STATUS_COLOR.down, label: STATUS_LABEL.down },
    { color: STATUS_COLOR.muted, label: 'Unknown or offline' },
  ]
  if (hasDamaged) out.push({ color: 'var(--wt-down-500)', label: 'Damaged bay', dashed: true })
  if (hasSpare) out.push({ color: 'var(--wt-n-500)', label: 'Spare (tagged)' })
  return out
}

export function Legend({ items }) {
  return (
    <div className="bw-legend">
      {items.map(l => (
        <span key={l.label}>
          <i style={l.dashed ? { border: `1.5px dashed ${l.color}`, background: 'transparent' } : { background: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  )
}

/** Visual style for a live bay tile in the current colour mode. */
function tileLook(colorBy, drive, bay, { groups, thresholds }) {
  const status = driveStatus(drive)
  if (colorBy === 'temp') {
    const band = tempBand(drive.temperature_c, thresholds)
    const c = band ? TEMP_COLOR[band] : 'var(--wt-n-400)'
    return { led: c, style: band ? { background: `color-mix(in oklch, ${c} 9%, var(--wt-surface))`, borderColor: `color-mix(in oklch, ${c} 38%, transparent)` } : {}, cls: '' }
  }
  if (colorBy === 'pool') {
    const c = groupColor(groups, poolGroupKey(drive, bay))
    return { led: c, style: { background: `color-mix(in oklch, ${c} 10%, var(--wt-surface))`, borderColor: `color-mix(in oklch, ${c} 40%, transparent)` }, cls: '' }
  }
  // Health: calm by default — only degraded/failing tiles get a tint.
  return { led: STATUS_COLOR[status], style: {}, cls: status === 'warn' ? 'bw-bay--warn' : status === 'down' ? 'bw-bay--down' : status === 'muted' ? 'bw-bay--muted' : '' }
}

export function BayTile({ bay, drive, colorBy, density, query, selected, onPick, onEmpty, ctx, readOnly, isMobile }) {
  const state = bayState(bay, drive)
  const label = bayLabel(bay)
  const match = matchesQuery(query, bay, drive)
  const minH = isMobile ? 72 : density === 'comfortable' ? 128 : 92
  const dim = match ? '' : 'bw-bay--dim'

  if (state === 'damaged') {
    return (
      <button type="button" className={`bw-bay bw-bay--damaged ${dim}`} style={{ minHeight: minH, justifyContent: 'space-between' }}
        onClick={readOnly ? undefined : () => onEmpty?.(bay)} disabled={readOnly}
        aria-label={`Bay ${label}, damaged${drive ? `, holds ${driveName(drive)}` : ''}`}>
        <span className="bw-bay__tag">{label}</span>
        {isMobile
          ? <span className="text-[11px] font-semibold" style={{ color: 'var(--wt-down-600)' }}>Damaged</span>
          : <span className="wt-pill wt-pill--solid-down">Bay damaged</span>}
      </button>
    )
  }
  if (state === 'empty') {
    return (
      <button type="button" className={`bw-bay bw-bay--empty ${dim}`} style={{ minHeight: minH, justifyContent: 'space-between' }}
        onClick={readOnly ? undefined : () => onEmpty?.(bay)} disabled={readOnly}
        aria-label={`Bay ${label}, empty${readOnly ? '' : '. Add or assign a drive'}`}>
        <span className="bw-bay__tag">{label}</span>
        <span className={isMobile ? 'text-[11px]' : 'text-[13px]'}>{isMobile ? 'Empty' : 'Empty bay'}</span>
      </button>
    )
  }

  const { led, style, cls } = tileLook(colorBy, drive, bay, ctx)
  const status = driveStatus(drive)
  const spare = isSpare(drive, bay)
  const offline = drive.is_connected === false
  const t = drive.temperature_c
  const band = tempBand(t, ctx.thresholds)
  const pct = t == null ? 0 : Math.max(8, Math.min(100, ((t - 20) / Math.max(10, ctx.thresholds.dangerC + 5 - 20)) * 100))
  const meta = colorBy === 'pool' ? (spare ? 'Spare' : drive.vdev_name || drive.zfs_pool || 'No pool') : fmtCap(drive.capacity_bytes)
  const aria = [
    `Bay ${label}`, driveName(drive), t != null ? `${t} degrees` : null,
    offline ? 'offline' : driveStatusLabel(drive), spare ? 'spare' : null,
  ].filter(Boolean).join(', ')

  if (isMobile) {
    // The 390px map: bay, LED and temperature only. Text still carries spare/failing state.
    return (
      <button type="button" className={`bw-bay ${cls} ${dim}`} style={{ minHeight: minH, justifyContent: 'space-between', ...style }}
        aria-pressed={selected} aria-label={aria} onClick={() => onPick(bay, drive)}>
        <div className="flex justify-between items-center w-full gap-1">
          <span className="wt-mono text-[11px] font-semibold" style={{ color: 'var(--wt-text-subtle)' }}>{label}</span>
          <Led color={led} hollow={offline && colorBy === 'health'} />
        </div>
        <div className="flex justify-between items-baseline w-full gap-1">
          <span className="bw-metric" style={{ fontSize: 'var(--wt-text-md)' }}>{t != null ? `${t}°` : '—'}</span>
          {status === 'down' && colorBy === 'health'
            ? <span className="text-[10.5px] font-bold" style={{ color: 'var(--wt-down-600)' }}>Fail</span>
            : spare ? <span className="text-[10.5px] font-semibold" style={{ color: 'var(--wt-text-subtle)' }}>Spare</span> : null}
        </div>
      </button>
    )
  }

  return (
    <button type="button" className={`bw-bay ${cls} ${dim}`} style={{ minHeight: minH, ...style }}
      aria-pressed={selected} aria-label={aria} onClick={() => onPick(bay, drive)}>
      <div className="flex justify-between items-center w-full gap-2">
        <span className="bw-bay__tag">{label}</span>
        <span className="flex items-center gap-2">
          {spare && <span className="wt-chip wt-chip--plain" style={{ padding: '0 6px', fontSize: 10.5 }}>Spare</span>}
          {status === 'down' && colorBy === 'health' && <span className="wt-pill wt-pill--solid-down" style={{ padding: '1px 7px', fontSize: 10.5 }}>Failing</span>}
          <Led color={led} hollow={offline && colorBy === 'health'} />
        </span>
      </div>
      {density === 'comfortable' && (
        <div className="mt-2.5 min-w-0 w-full">
          <div className="font-bold text-sm truncate" style={{ letterSpacing: '-0.01em' }}>{drive.model || drive.serial}</div>
          <div className="text-xs truncate" style={{ color: 'var(--wt-text-muted)' }}>{drive.make || ' '}</div>
        </div>
      )}
      <div className="mt-auto pt-3 w-full">
        <div className="flex justify-between items-baseline gap-2">
          <span className="bw-metric bw-bay__temp">{t != null ? <>{t}<small>°C</small></> : <span style={{ color: 'var(--wt-text-faint)' }}>—</span>}</span>
          <span className="wt-mono text-[11.5px] truncate" style={{ color: 'var(--wt-text-muted)' }}>{meta}</span>
        </div>
        <div className="bw-bay__bar" aria-hidden="true">
          {t != null && <div style={{ width: `${pct.toFixed(0)}%`, background: TEMP_COLOR[band] }} />}
        </div>
      </div>
    </button>
  )
}

/** A small array (e.g. a single NVMe slot) rendered as compact chips instead of a grid. */
function SmallArray({ array, bays, driveMap, query, selectedBayId, onPick, onEmpty, ctx, readOnly }) {
  return (
    <div className="flex flex-wrap gap-2">
      {bays.map(bay => {
        const drive = bay.drive_serial ? driveMap[bay.drive_serial] : null
        const match = matchesQuery(query, bay, drive, array.name)
        const common = {
          className: `bw-loc ${match ? '' : 'bw-bay--dim'}`,
          style: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, maxWidth: '100%', minWidth: 0 },
        }
        if (!drive) {
          return (
            <button key={bay.id} type="button" {...common} onClick={readOnly ? undefined : () => onEmpty?.(bay)} disabled={readOnly}>
              <span className="font-semibold text-[13px]">{array.name} {bayLabel(bay)}</span>
              <span className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>{bay.status === 'damaged' ? 'Damaged' : 'Empty'}</span>
            </button>
          )
        }
        return (
          <button key={bay.id} type="button" {...common} aria-pressed={selectedBayId === bay.id} onClick={() => onPick(bay, drive)}>
            <Led status={driveStatus(drive)} hollow={drive.is_connected === false} />
            <span className="font-semibold text-[13px] whitespace-nowrap">{array.name}{bays.length > 1 ? ` ${bayLabel(bay)}` : ''}</span>
            <span className="text-[12.5px] truncate min-w-0" style={{ color: 'var(--wt-text-muted)' }}>
              {driveName(drive)}, {fmtCap(drive.capacity_bytes)}{drive.temperature_c != null ? <>, <span className="wt-mono">{drive.temperature_c}°C</span></> : null}
              {array.purpose ? `, ${array.purpose}` : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Offline shelf: the last-known details of each slot, as a list. */
export function ShelfList({ location, query, onPick, readOnly }) {
  const slots = location.arrays.flatMap(({ array, bays }) => bays.map(bay => ({ array, bay })))
    .sort((a, b) => a.bay.row - b.bay.row || a.bay.col - b.bay.col)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="bw-note">
        <Led status="muted" />
        {location.remote ? 'This instance could not be reached, so these show their last synced details.' : 'Shelf is offline, so these show their last known details.'}
      </div>
      {slots.map(({ array, bay }) => {
        const d = bay.drive_serial ? location.driveMap[bay.drive_serial] : null
        const match = matchesQuery(query, bay, d)
        const inner = (
          <>
            <span className="bw-bay__tag">{bayLabel(bay)}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-sm truncate">{d ? driveName(d) : bay.status === 'damaged' ? 'Damaged bay' : 'Empty slot'}</span>
              {d && (
                <span className="block wt-mono text-xs truncate" style={{ color: 'var(--wt-text-muted)' }}>
                  {d.serial} · {fmtCap(d.capacity_bytes)} · {d.power_on_hours != null ? fmtAge(d.power_on_hours) : 'Age unknown'}
                </span>
              )}
            </span>
            {d && <SmartPill status={d.smart_status} />}
          </>
        )
        return d && !readOnly ? (
          <button key={`${array.id}-${bay.id ?? `${bay.row}-${bay.col}`}`} type="button" className={`bw-slot ${match ? '' : 'bw-bay--dim'}`} onClick={() => onPick(bay, d)}
            aria-label={`Slot ${bayLabel(bay)}, ${driveName(d)}, offline`}>
            {inner}
          </button>
        ) : (
          <div key={`${array.id}-${bay.id ?? `${bay.row}-${bay.col}`}`} className={`bw-slot ${match ? '' : 'bw-bay--dim'}`}>{inner}</div>
        )
      })}
    </div>
  )
}

/** One bay array as a grid in its true row × column shape. */
export function BayArrayGrid({ array, bays, driveMap, ...tileProps }) {
  const grid = Array.from({ length: array.rows * array.cols }, () => null)
  for (const b of bays) if (b.row < array.rows && b.col < array.cols) grid[b.row * array.cols + b.col] = b
  const minTile = tileProps.density === 'comfortable' ? 132 : 96
  return (
    <div className="bw-chassis">
      <div className="bw-bays" style={{ gridTemplateColumns: `repeat(${array.cols}, minmax(${tileProps.isMobile ? 0 : 120}px, 1fr))`, minWidth: tileProps.isMobile ? 0 : array.cols * minTile }}>
        {grid.map((bay, i) => bay
          ? <BayTile key={bay.id ?? i} bay={bay} drive={bay.drive_serial ? driveMap[bay.drive_serial] : null}
              selected={tileProps.selectedBayId != null && tileProps.selectedBayId === bay.id} {...tileProps} />
          : <div key={`gap-${i}`} aria-hidden="true" />)}
      </div>
    </div>
  )
}

/**
 * Everything for the selected location: per-array title + controls, legend, grids and small slots.
 */
export function LocationBody({ location, colorBy, density, query, selectedBayId, onPick, onEmpty, ctx, isMobile }) {
  if (location.offline) return <ShelfList location={location} query={query} onPick={onPick} readOnly={location.remote} />
  if (!location.arrays.length) {
    return <div className="bw-note">No bay arrays yet. Add one in Settings → Enclosures.</div>
  }
  const maxBays = Math.max(...location.arrays.map(a => a.bays.length))
  const small = location.arrays.filter(a => a.bays.length <= 2 && a.bays.length < maxBays)
  const big = location.arrays.filter(a => !small.includes(a))
  const tileProps = { colorBy, density, query, selectedBayId, onPick, onEmpty, ctx, isMobile, readOnly: location.remote }
  return (
    <div className="flex flex-col gap-4">
      {small.length > 0 && (
        <div className="flex flex-col gap-2">
          {small.map(({ array, bays }) => (
            <SmallArray key={array.id} array={array} bays={bays} driveMap={location.driveMap} {...tileProps} />
          ))}
        </div>
      )}
      {big.map(({ array, bays }) => (
        <div key={array.id} className="flex flex-col gap-2">
          {big.length > 1 && (
            <div className="flex items-baseline gap-2">
              <span className="font-bold">{array.name}</span>
              <span className="text-xs" style={{ color: 'var(--wt-text-muted)' }}>
                {bays.filter(b => b.drive_serial).length} of {plural(bays.length, 'bay')}
              </span>
            </div>
          )}
          <BayArrayGrid array={array} bays={bays} driveMap={location.driveMap} {...tileProps} />
        </div>
      ))}
    </div>
  )
}

export function locationTitle(location) {
  const big = [...location.arrays].sort((a, b) => b.bays.length - a.bays.length)[0]
  if (!big) return { title: location.name, chip: null, sub: location.sub }
  const maxBays = big.bays.length
  // Small side arrays (e.g. one NVMe slot) are shown as chips, so they don't count toward the grid summary.
  const main = location.arrays.filter(a => !(a.bays.length <= 2 && a.bays.length < maxBays))
  const populated = main.reduce((s, a) => s + a.bays.filter(b => b.drive_serial).length, 0)
  const total = main.reduce((s, a) => s + a.bays.length, 0)
  const chip = main.length === 1 ? GROUP_TYPE_LABEL[big.array.group_type] || null : null
  const shape = main.length === 1 ? `, ${plural(big.array.rows, 'row')} by ${plural(big.array.cols, 'column')}` : `, ${plural(main.length, 'array')}`
  const sub = location.offline
    ? `${plural(populated, 'drive')} on a ${location.kind === 'shelf' ? 'disk shelf' : location.kind}, currently disconnected`
    : `${populated} of ${plural(total, 'bay')} populated${shape}`
  return { title: main.length === 1 ? big.array.name : location.name, chip, sub }
}

export function legendItems(colorBy, location, ctx) {
  const all = location.arrays.flatMap(a => a.bays)
  const keys = new Set(all.map(b => b.drive_serial && poolGroupKey(location.driveMap[b.drive_serial], b)).filter(Boolean))
  return legendFor(colorBy, {
    groups: ctx.groups.filter(g => keys.has(g.key)), thresholds: ctx.thresholds,
    hasDamaged: all.some(b => b.status === 'damaged'),
    hasSpare: all.some(b => isSpare(location.driveMap[b.drive_serial], b)),
  })
}
