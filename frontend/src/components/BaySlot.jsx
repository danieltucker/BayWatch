import clsx from 'clsx'
import { useDroppable } from '@dnd-kit/core'
import { getDriveIcon } from '../utils/driveIcon'
import { useTempThresholds } from '../context/TempThresholdContext'

function formatCapacity(bytes) {
  if (!bytes) return null
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)} TB`
  return `${(bytes / 1e9).toFixed(0)} GB`
}

function statusStyle(status) {
  if (status === 'PASSED') return {
    border: 'border-emerald-400/60 dark:border-emerald-700/60',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    hover: 'hover:border-emerald-500/80 dark:hover:border-emerald-500/60 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    icon: 'text-emerald-500 dark:text-emerald-400',
    lgFrom: 'from-emerald-50 dark:from-emerald-950/30',
    lgBorder: 'border-emerald-200 dark:border-emerald-800/60',
  }
  if (status === 'FAILED') return {
    border: 'border-red-400/60 dark:border-red-700/60',
    bg: 'bg-red-50 dark:bg-red-950/20 animate-pulse',
    hover: 'hover:border-red-500 dark:hover:border-red-500/60 hover:bg-red-100/80 dark:hover:bg-red-950/40',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
    icon: 'text-red-500 dark:text-red-400',
    lgFrom: 'from-red-50 dark:from-red-950/30',
    lgBorder: 'border-red-200 dark:border-red-800/60',
  }
  return {
    border: 'border-slate-300/60 dark:border-gray-600/50',
    bg: 'bg-slate-100 dark:bg-gray-800/40',
    hover: 'hover:border-slate-400/70 dark:hover:border-gray-500/60 hover:bg-slate-100 dark:hover:bg-gray-800/60',
    text: 'text-slate-500 dark:text-gray-400',
    dot: 'bg-slate-400 dark:bg-gray-500',
    icon: 'text-slate-400 dark:text-gray-500',
    lgFrom: 'from-slate-50 dark:from-gray-800/20',
    lgBorder: 'border-slate-200 dark:border-gray-700/50',
  }
}

const BAY_STATUS_STYLE = {
  damaged:    { badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/40', label: 'DMG', ring: 'ring-1 ring-orange-500/40 !border-orange-500/50' },
  hot_spare:  { badge: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',       label: 'HS',  ring: 'ring-1 ring-cyan-500/40 !border-cyan-500/50' },
  cold_spare: { badge: 'bg-violet-500/20 text-violet-400 border border-violet-500/40', label: 'CS',  ring: 'ring-1 ring-violet-500/40 !border-violet-500/50' },
}

const GAP = { sm: 'gap-1', md: 'gap-1.5', lg: 'gap-2' }

export default function BaySlot({ bay, drive, profile, isSelected, isVdevPeer, onClick, size = 'sm' }) {
  const { setNodeRef, isOver } = useDroppable({ id: bay.id })
  const { warnC, dangerC } = useTempThresholds()
  const isEmpty = !drive
  const label = bay.label || `${bay.row + 1}-${bay.col + 1}`
  const s = drive ? statusStyle(drive.smart_status) : null
  const bayStatus = BAY_STATUS_STYLE[bay.status] ?? null
  const isPeer = isVdevPeer && !isSelected

  // Drag-over and selection highlights — work for all sizes
  const selectionHighlight = clsx(
    isOver && '!border-blue-400 !bg-blue-50 dark:!bg-blue-950/40 ring-2 ring-blue-400/40',
    isSelected && '!border-blue-500/70 dark:!border-white/60 ring-2 ring-blue-400/20 dark:ring-white/20',
  )
  // Peer highlight for SM/MD: flat bg override with !important is safe since no gradient
  const peerFlat = isPeer && '!bg-blue-50 dark:!bg-blue-950/30 ring-1 ring-blue-400/60 !border-blue-500/50'

  // ── SM: compact row — make · size on left, temp + dot on right ───────────────
  if (size === 'sm') {
    const cap = drive ? formatCapacity(drive.capacity_bytes) : null
    const makeSize = drive
      ? [drive.make, cap].filter(Boolean).join(' · ')
      : null

    return (
      <div
        ref={setNodeRef}
        onClick={() => onClick?.(bay)}
        className={clsx(
          'h-8 flex items-center px-2 gap-1.5 rounded border cursor-pointer select-none transition-all duration-150',
          isEmpty
            ? 'border-dashed border-slate-200 dark:border-gray-800/50 hover:border-slate-300 dark:hover:border-gray-700/60 bg-transparent'
            : clsx(s.border, s.bg, s.hover),
          bayStatus?.ring,
          selectionHighlight,
          peerFlat,
        )}
      >
        <span className="text-[10px] text-slate-400 dark:text-gray-700 font-mono w-5 shrink-0 leading-none">{label}</span>
        {drive ? (
          <>
            <span className={clsx('text-[10px] flex-1 truncate leading-none', s.text)}>
              {makeSize || drive.serial?.slice(-8)}
            </span>
            {drive.temperature_c != null && (
              <span className={clsx(
                'text-[10px] font-mono shrink-0 leading-none',
                drive.temperature_c >= dangerC ? 'text-red-500 dark:text-red-400' :
                drive.temperature_c >= warnC   ? 'text-amber-500 dark:text-amber-400' :
                'text-slate-400 dark:text-gray-600'
              )}>
                {drive.temperature_c}°
              </span>
            )}
            <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
          </>
        ) : (
          <span className="text-slate-200 dark:text-gray-800 text-sm flex-1">·</span>
        )}
        {bayStatus && (
          <span className={clsx('text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0', bayStatus.badge)}>
            {bayStatus.label}
          </span>
        )}
      </div>
    )
  }

  // ── MD: card — icon + make (primary) + serial (secondary) + temp bar ─────────
  if (size === 'md') {
    const Icon = drive ? getDriveIcon(drive.form_factor, drive.rpm) : null
    return (
      <div
        ref={setNodeRef}
        onClick={() => onClick?.(bay)}
        className={clsx(
          'relative min-h-[80px] flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border cursor-pointer select-none transition-all duration-150 group',
          isEmpty
            ? 'border-dashed border-slate-300 dark:border-gray-700/50 bg-slate-50 dark:bg-gray-900/20 hover:border-slate-400 dark:hover:border-gray-600/70 hover:bg-slate-100 dark:hover:bg-gray-800/20'
            : clsx(s.border, s.bg, s.hover),
          selectionHighlight,
          peerFlat,
        )}
      >
        <span className="absolute top-1 left-1.5 text-[9px] text-slate-400 dark:text-gray-700 font-mono leading-none">{label}</span>
        {drive && !bayStatus && <span className={clsx('absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full', s.dot)} />}
        {bayStatus && (
          <span className={clsx('absolute top-1 right-1 text-[9px] font-mono font-bold px-1 py-0.5 rounded leading-none', bayStatus.badge)}>
            {bayStatus.label}
          </span>
        )}
        {isEmpty ? (
          <span className="text-slate-300 dark:text-gray-800 text-xl">·</span>
        ) : (
          <>
            <Icon size={18} className={clsx('mt-0.5 transition-transform group-hover:scale-110', s.icon)} />
            {/* Make as primary */}
            <span className={clsx('text-[10px] font-medium px-1 truncate w-full text-center leading-none', s.text)}>
              {drive.make || drive.model || '—'}
            </span>
            {/* Serial as secondary */}
            <span className="text-[9px] font-mono text-slate-400 dark:text-gray-500 px-1 truncate w-full text-center leading-none">
              {drive.serial?.slice(-6)}
            </span>
            {drive.temperature_c != null && (
              <div className="w-full px-1 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-[3px] flex-1 rounded-full bg-slate-200/80 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full',
                        drive.temperature_c >= dangerC ? 'bg-red-400' :
                        drive.temperature_c >= warnC   ? 'bg-amber-400' : 'bg-sky-400'
                      )}
                      style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
                    />
                  </div>
                  <span className={clsx('text-[9px] font-mono leading-none shrink-0',
                    drive.temperature_c >= dangerC ? 'text-red-500 dark:text-red-400' :
                    drive.temperature_c >= warnC   ? 'text-amber-500 dark:text-amber-400' :
                    'text-slate-400 dark:text-gray-600'
                  )}>
                    {drive.temperature_c}°
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── LG: rich gradient card ───────────────────────────────────────────────────
  const Icon = drive ? getDriveIcon(drive.form_factor, drive.rpm) : null
  const cap = drive ? formatCapacity(drive.capacity_bytes) : null
  const warrantyDays = profile?.warranty_days_remaining ?? null

  // For LG, apply blue gradient directly (no !important needed) for vdev peers
  const lgBg = isEmpty
    ? 'border-dashed border-slate-200 dark:border-gray-700/50 bg-slate-50/50 dark:bg-gray-900/10 hover:border-slate-300 dark:hover:border-gray-600'
    : isPeer
    ? 'bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900/60 border-blue-300/70 dark:border-blue-700/50 hover:from-blue-100/70 dark:hover:from-blue-950/50'
    : clsx('bg-gradient-to-b to-white dark:to-gray-900/60', s.lgFrom, s.lgBorder, s.hover)

  return (
    <div
      ref={setNodeRef}
      onClick={() => onClick?.(bay)}
      className={clsx(
        'relative min-h-[150px] flex flex-col rounded-xl border cursor-pointer select-none transition-all duration-150 overflow-hidden group',
        lgBg,
        selectionHighlight,
        isPeer && !isSelected && 'ring-1 ring-blue-400/50',
      )}
    >
      <span className="absolute top-1.5 left-2 text-[9px] text-slate-400 dark:text-gray-600 font-mono leading-none z-10">{label}</span>
      {drive && !bayStatus && <span className={clsx('absolute top-1.5 right-1.5 w-2 h-2 rounded-full shadow-sm z-10', s.dot)} />}
      {bayStatus && (
        <span className={clsx('absolute top-1.5 right-1.5 z-10 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded leading-none', bayStatus.badge)}>
          {bayStatus.label}
        </span>
      )}

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-slate-200 dark:text-gray-800 text-3xl">·</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-1.5 px-2.5 pt-6 pb-2.5">
          {/* Icon + make/model */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/70 dark:bg-gray-800/60 border border-slate-200/80 dark:border-gray-700/40 flex items-center justify-center shrink-0">
              <Icon size={14} className={s.icon} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-800 dark:text-gray-200 leading-tight truncate">
                {drive.make || 'Unknown'}
              </p>
              {drive.model && (
                <p className="text-[9px] text-slate-400 dark:text-gray-500 leading-none truncate">{drive.model}</p>
              )}
            </div>
          </div>

          {/* Serial */}
          <span className={clsx('text-[10px] font-mono leading-none truncate', s.text)}>
            {drive.serial}
          </span>

          {/* Pool info */}
          {drive.zfs_pool && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400 dark:text-gray-500 font-mono truncate flex-1">
                {drive.zfs_pool}
              </span>
              {drive.vdev_name && (
                <span className="text-[9px] font-mono text-slate-400 dark:text-gray-600 shrink-0">
                  {drive.vdev_name}
                </span>
              )}
            </div>
          )}

          {/* Temp bar */}
          {drive.temperature_c != null && (
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-slate-400 dark:text-gray-600 uppercase tracking-wide">Temp</span>
                <span className={clsx(
                  'text-[10px] font-mono font-bold',
                  drive.temperature_c >= dangerC ? 'text-red-500 dark:text-red-400' :
                  drive.temperature_c >= warnC   ? 'text-amber-500 dark:text-amber-400' :
                  'text-sky-500 dark:text-sky-400'
                )}>
                  {drive.temperature_c}°C
                </span>
              </div>
              <div className="h-1 rounded-full bg-slate-200/80 dark:bg-gray-800">
                <div
                  className={clsx('h-full rounded-full transition-all',
                    drive.temperature_c >= dangerC ? 'bg-red-400' :
                    drive.temperature_c >= warnC   ? 'bg-amber-400' : 'bg-sky-400'
                  )}
                  style={{ width: `${Math.min(100, (drive.temperature_c / 70) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Capacity + device path */}
          <div className="flex items-center justify-between gap-1 mt-auto">
            {cap && <span className="text-[9px] text-slate-500 dark:text-gray-500">{cap}</span>}
            {drive.device_path && (
              <span className="text-[9px] font-mono text-slate-400 dark:text-gray-600 truncate">{drive.device_path}</span>
            )}
          </div>

          {/* Warranty badge */}
          {warrantyDays != null && warrantyDays <= 365 && (
            <div className={clsx(
              'text-[9px] font-medium rounded px-1.5 py-0.5 text-center',
              warrantyDays < 0
                ? 'bg-red-100 dark:bg-red-950/40 text-red-500 dark:text-red-400'
                : warrantyDays <= 90
                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
            )}>
              {warrantyDays < 0 ? 'Warranty expired' : `${Math.round(warrantyDays / 30)}mo left`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
