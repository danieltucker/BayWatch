import clsx from 'clsx'
import { useDroppable } from '@dnd-kit/core'
import { WifiOff } from 'lucide-react'
import { getDriveIcon } from '../utils/driveIcon'
import { useTempThresholds } from '../context/TempThresholdContext'

function formatCapacity(bytes) {
  if (!bytes) return null
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  return `${(bytes / 1e9).toFixed(0)} GB`
}

// Returns className strings (layout/structure) + a lgStyle object (gradient for LG cards)
function statusStyle(status) {
  if (status === 'PASSED') return {
    border: 'border-[color:var(--wt-up-100)]',
    bg: 'bg-[var(--wt-up-50)]',
    hover: 'hover:bg-[var(--wt-up-100)]',
    text: 'text-[var(--wt-up-600)]',
    icon: 'text-[var(--wt-up-500)]',
    lgStyle: { background: 'linear-gradient(to bottom, var(--wt-up-50), var(--wt-surface))', borderColor: 'var(--wt-up-100)' },
  }
  if (status === 'FAILED') return {
    border: 'border-[color:var(--wt-down-100)] animate-pulse',
    bg: 'bg-[var(--wt-down-50)]',
    hover: 'hover:bg-[var(--wt-down-100)]',
    text: 'text-[var(--wt-down-600)]',
    icon: 'text-[var(--wt-down-500)]',
    lgStyle: { background: 'linear-gradient(to bottom, var(--wt-down-50), var(--wt-surface))', borderColor: 'var(--wt-down-100)' },
  }
  return {
    border: 'border-[color:var(--wt-border)]',
    bg: 'bg-[var(--wt-surface-2)]',
    hover: 'hover:bg-[var(--wt-surface-3)]',
    text: 'text-[var(--wt-text-subtle)]',
    icon: 'text-[var(--wt-text-faint)]',
    lgStyle: { background: 'linear-gradient(to bottom, var(--wt-surface-2), var(--wt-surface))', borderColor: 'var(--wt-border)' },
  }
}

// Bay-status badge styles: use wt-warn for hot_spare, wt-down for damaged, wt-brand for cold_spare
const BAY_STATUS_STYLE = {
  damaged:    { badgeStyle: { background: 'var(--wt-down-50)', color: 'var(--wt-down-600)', border: '1px solid var(--wt-down-100)' },  label: 'DMG' },
  hot_spare:  { badgeStyle: { background: 'var(--wt-warn-50)', color: 'var(--wt-warn-700)', border: '1px solid var(--wt-warn-100)' },  label: 'HS'  },
  cold_spare: { badgeStyle: { background: 'var(--wt-brand-50)', color: 'var(--wt-brand-700)', border: '1px solid var(--wt-brand-100)' }, label: 'CS'  },
}

function healthDotStyle(drive) {
  if (!drive) return { background: 'var(--wt-n-300)' }
  if (drive.smart_status === 'FAILED') return { background: 'var(--wt-down-500)' }
  if (drive.smart_status === 'PASSED') {
    const hasErrors = (drive.reallocated_sectors ?? 0) > 0
      || (drive.pending_sectors ?? 0) > 0
      || (drive.uncorrectable_errors ?? 0) > 0
    return { background: hasErrors ? 'var(--wt-warn-500)' : 'var(--wt-up-500)' }
  }
  return { background: 'var(--wt-n-400)' }
}

const STATUS_TILE_STYLE = {
  damaged:    { background: 'var(--wt-down-50)',  borderColor: 'var(--wt-down-100)'  },
  hot_spare:  { background: 'var(--wt-warn-50)',  borderColor: 'var(--wt-warn-100)'  },
  cold_spare: { background: 'var(--wt-brand-50)', borderColor: 'var(--wt-brand-100)' },
}

const GAP = { sm: 'gap-1', md: 'gap-1.5', lg: 'gap-2' }

export default function BaySlot({ bay, drive, profile, isSelected, isVdevPeer, onClick, onHover, onHoverEnd, size = 'sm' }) {
  const { setNodeRef, isOver } = useDroppable({ id: bay.id })
  const { warnC, dangerC } = useTempThresholds()
  const isEmpty = !drive
  const isDisconnected = !!drive && drive.is_connected === false
  const label = bay.label || `${bay.row + 1}-${bay.col + 1}`
  const s = drive ? statusStyle(drive.smart_status) : null
  const bayStatus = BAY_STATUS_STYLE[bay.status] ?? null
  const isPeer = isVdevPeer && !isSelected

  const selectionHighlight = clsx(
    isOver     && '!border-[color:var(--wt-brand-400)] ring-2 ring-[color:var(--wt-brand-300)]',
    isSelected && '!border-[color:var(--wt-brand-500)] ring-2 ring-[color:var(--wt-brand-300)]',
  )
  const peerFlat = isPeer && '!bg-[var(--wt-brand-50)] ring-1 ring-[color:var(--wt-brand-300)] !border-[color:var(--wt-brand-200)]'

  // ── SM: compact row — make · size on left, temp + dot on right ───────────────
  if (size === 'sm') {
    const cap = drive ? formatCapacity(drive.capacity_bytes) : null
    const makeSize = drive
      ? [drive.make, cap].filter(Boolean).join(' · ')
      : null

    const tileStyle = bay.status && STATUS_TILE_STYLE[bay.status]

    return (
      <div
        ref={setNodeRef}
        onClick={() => onClick?.(bay)}
        onMouseEnter={() => onHover?.(bay)}
        onMouseLeave={onHoverEnd}
        style={tileStyle || undefined}
        className={clsx(
          'h-8 flex items-center px-2 gap-1.5 rounded border cursor-pointer select-none transition-all duration-150',
          isEmpty
            ? 'border-dashed border-[color:var(--wt-border)] hover:border-[color:var(--wt-border-strong)] bg-transparent'
            : !tileStyle && clsx(s.border, s.bg, s.hover),
          selectionHighlight,
          peerFlat,
        )}
      >
        <span className="wt-mono text-[10px] w-5 shrink-0 leading-none" style={{ color: 'var(--wt-text-faint)' }}>{label}</span>
        {drive ? (
          <div className={clsx('flex-1 flex items-center gap-1.5 min-w-0', isDisconnected && 'opacity-50')}>
            <span className={clsx('text-[10px] flex-1 truncate leading-none', s.text)}>
              {makeSize || drive.serial?.slice(-8)}
            </span>
            {isDisconnected
              ? <WifiOff size={10} className="shrink-0" style={{ color: 'var(--wt-warn-500)' }} />
              : drive.temperature_c != null && (
                <span className="wt-mono text-[10px] shrink-0 leading-none" style={{ color:
                  drive.temperature_c >= dangerC ? 'var(--wt-down-500)' :
                  drive.temperature_c >= warnC   ? 'var(--wt-warn-500)' :
                  'var(--wt-text-faint)'
                }}>
                  {drive.temperature_c}°
                </span>
              )
            }
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={healthDotStyle(drive)} />
          </div>
        ) : (
          <span className="text-sm flex-1" style={{ color: 'var(--wt-text-faint)' }}>·</span>
        )}
        {bayStatus && (
          <span className="wt-mono text-[9px] font-bold px-1 py-0.5 rounded shrink-0" style={bayStatus.badgeStyle}>
            {bayStatus.label}
          </span>
        )}
      </div>
    )
  }

  // ── MD: card — icon + make (primary) + serial (secondary) + temp bar ─────────
  if (size === 'md') {
    const Icon = drive ? getDriveIcon(drive.form_factor, drive.rpm) : null
    const tileStyle = bay.status && STATUS_TILE_STYLE[bay.status]
    return (
      <div
        ref={setNodeRef}
        onClick={() => onClick?.(bay)}
        onMouseEnter={() => onHover?.(bay)}
        onMouseLeave={onHoverEnd}
        style={tileStyle || undefined}
        className={clsx(
          'relative min-h-[80px] flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border cursor-pointer select-none transition-all duration-150 group',
          isEmpty
            ? 'border-dashed border-[color:var(--wt-border)] bg-[var(--wt-surface-2)] hover:border-[color:var(--wt-border-strong)]'
            : !tileStyle && clsx(s.border, s.bg, s.hover),
          selectionHighlight,
          peerFlat,
        )}
      >
        <span className="absolute top-1 left-1.5 wt-mono text-[9px] leading-none" style={{ color: 'var(--wt-text-faint)' }}>{label}</span>
        {drive && <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full" style={healthDotStyle(drive)} />}
        {bayStatus && (
          <span className="absolute top-1 right-1 wt-mono text-[9px] font-bold px-1 py-0.5 rounded leading-none" style={bayStatus.badgeStyle}>
            {bayStatus.label}
          </span>
        )}
        {isEmpty ? (
          <span className="text-xl" style={{ color: 'var(--wt-text-faint)' }}>·</span>
        ) : (
          <div className={clsx('flex flex-col items-center gap-1', isDisconnected && 'opacity-50')}>
            <Icon size={18} className={clsx('mt-0.5 transition-transform group-hover:scale-110', s.icon)} />
            <span className={clsx('text-[10px] font-medium px-1 truncate w-full text-center leading-none', s.text)}>
              {drive.make || drive.model || '—'}
            </span>
            <span className="wt-mono text-[9px] px-1 truncate w-full text-center leading-none" style={{ color: 'var(--wt-text-subtle)' }}>
              {drive.serial?.slice(-6)}
            </span>
            {isDisconnected ? (
              <WifiOff size={10} className="mt-0.5" style={{ color: 'var(--wt-warn-500)' }} />
            ) : drive.temperature_c != null && (
              <div className="w-full px-1 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="wt-meter flex-1">
                    <div
                      className="wt-meter__fill wt-meter__fill--temp"
                      style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
                    />
                  </div>
                  <span className="wt-mono text-[9px] leading-none shrink-0" style={{ color:
                    drive.temperature_c >= dangerC ? 'var(--wt-down-500)' :
                    drive.temperature_c >= warnC   ? 'var(--wt-warn-500)' :
                    'var(--wt-text-faint)'
                  }}>
                    {drive.temperature_c}°
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── LG: rich gradient card ───────────────────────────────────────────────────
  const Icon = drive ? getDriveIcon(drive.form_factor, drive.rpm) : null
  const cap = drive ? formatCapacity(drive.capacity_bytes) : null
  const warrantyDays = profile?.warranty_days_remaining ?? null

  const tileStyle = bay.status && STATUS_TILE_STYLE[bay.status]
  const lgStyle = isEmpty
    ? { borderColor: 'var(--wt-border)', background: 'var(--wt-surface-2)' }
    : tileStyle || (isPeer
      ? { background: 'linear-gradient(to bottom, var(--wt-brand-50), var(--wt-surface))', borderColor: 'var(--wt-brand-200)' }
      : s.lgStyle)

  return (
    <div
      ref={setNodeRef}
      onClick={() => onClick?.(bay)}
      onMouseEnter={() => onHover?.(bay)}
      onMouseLeave={onHoverEnd}
      style={lgStyle}
      className={clsx(
        '@container relative min-h-[190px] flex flex-col rounded-xl border cursor-pointer select-none transition-all duration-150 overflow-hidden group',
        isEmpty && 'border-dashed',
        selectionHighlight,
        isPeer && !isSelected && 'ring-1 ring-[color:var(--wt-brand-300)]',
      )}
    >
      <span className="absolute top-1.5 left-2 wt-mono text-[9px] leading-none z-10" style={{ color: 'var(--wt-text-faint)' }}>{label}</span>
      {drive && <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm z-10" style={healthDotStyle(drive)} />}
      {bayStatus && (
        <span className="absolute top-1.5 right-1.5 z-10 wt-mono text-[9px] font-bold px-1.5 py-0.5 rounded leading-none" style={bayStatus.badgeStyle}>
          {bayStatus.label}
        </span>
      )}

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-3xl" style={{ color: 'var(--wt-text-faint)' }}>·</span>
        </div>
      ) : (
        <div className={clsx('flex-1 flex flex-col gap-2 px-2.5 pt-7 pb-3', isDisconnected && 'opacity-50')}>
          {/* Icon + make/model */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--wt-surface)', border: '1px solid var(--wt-border)' }}>
              <Icon size={15} className={s.icon} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: 'var(--wt-text)' }}>
                {drive.make || 'Unknown'}
              </p>
              {drive.model && (
                <p className="text-[11px] leading-none truncate" style={{ color: 'var(--wt-text-subtle)' }}>{drive.model}</p>
              )}
            </div>
          </div>

          {/* Serial */}
          <span className={clsx('wt-mono text-[10px] leading-none truncate', s.text)}>
            {drive.serial}
          </span>

          {/* Pool info — hidden on narrow cards */}
          {drive.zfs_pool && (
            <div className="hidden @[130px]:flex items-center gap-1.5">
              <span className="wt-mono text-[10px] truncate flex-1" style={{ color: 'var(--wt-text-subtle)' }}>
                {drive.zfs_pool}
              </span>
              {drive.vdev_name && (
                <span className="wt-mono text-[10px] shrink-0" style={{ color: 'var(--wt-text-faint)' }}>
                  {drive.vdev_name}
                </span>
              )}
            </div>
          )}

          {/* Temp bar or disconnected indicator */}
          {isDisconnected ? (
            <div className="flex items-center gap-1.5">
              <WifiOff size={11} className="shrink-0" style={{ color: 'var(--wt-warn-500)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--wt-warn-600)' }}>Not detected</span>
            </div>
          ) : drive.temperature_c != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="wt-eyebrow">Temp</span>
                <span className="wt-mono text-[10px] font-bold" style={{ color:
                  drive.temperature_c >= dangerC ? 'var(--wt-down-500)' :
                  drive.temperature_c >= warnC   ? 'var(--wt-warn-500)' :
                  'var(--wt-teal-500)'
                }}>
                  {drive.temperature_c}°C
                </span>
              </div>
              <div className="wt-meter">
                <div
                  className="wt-meter__fill wt-meter__fill--temp"
                  style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Capacity + device path — hidden on narrow cards */}
          <div className="hidden @[130px]:flex items-center justify-between gap-1 mt-auto">
            {cap && <span className="text-[10px]" style={{ color: 'var(--wt-text-muted)' }}>{cap}</span>}
            {drive.device_path && (
              <span className="wt-mono text-[10px] truncate" style={{ color: 'var(--wt-text-faint)' }}>{drive.device_path}</span>
            )}
          </div>

          {/* Warranty badge */}
          {warrantyDays != null && warrantyDays <= 365 && (
            <div
              className="text-[9px] font-medium rounded px-1.5 py-0.5 text-center"
              style={warrantyDays < 0
                ? { background: 'var(--wt-down-50)', color: 'var(--wt-down-600)' }
                : warrantyDays <= 90
                ? { background: 'var(--wt-warn-50)', color: 'var(--wt-warn-700)' }
                : { background: 'var(--wt-up-50)', color: 'var(--wt-up-700)' }
              }
            >
              {warrantyDays < 0 ? 'Warranty expired' : `${Math.round(warrantyDays / 30)}mo left`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
