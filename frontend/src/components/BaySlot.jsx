import clsx from 'clsx'
import { useDroppable } from '@dnd-kit/core'
import { getDriveIcon } from '../utils/driveIcon'

function formatCapacity(bytes) {
  if (!bytes) return ''
  const tb = bytes / 1e12
  if (tb >= 1) return `${tb.toFixed(1)}T`
  return `${(bytes / 1e9).toFixed(0)}G`
}

function slotStyle(status) {
  if (status === 'PASSED') return {
    outer: 'border-emerald-400/70 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/30 hover:border-emerald-500 dark:hover:border-emerald-500/80 hover:bg-emerald-100 dark:hover:bg-emerald-950/50',
    icon: 'text-emerald-500 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400 shadow-emerald-400/60',
  }
  if (status === 'FAILED') return {
    outer: 'border-red-400/70 dark:border-red-600/70 bg-red-50 dark:bg-red-950/40 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-100 dark:hover:bg-red-950/60 animate-pulse',
    icon: 'text-red-500 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400 shadow-red-400/60',
  }
  return {
    outer: 'border-slate-300/70 dark:border-gray-600/50 bg-slate-100 dark:bg-gray-800/40 hover:border-slate-400 dark:hover:border-gray-500/70',
    icon: 'text-slate-400 dark:text-gray-500',
    dot: 'bg-slate-400 dark:bg-gray-500',
  }
}

const SIZE_DIMS = {
  sm: 'w-[72px] h-[72px]',
  md: 'w-[88px] h-[88px]',
  lg: 'w-[108px] h-[108px]',
}

const ICON_SIZE = { sm: 17, md: 18, lg: 20 }

export default function BaySlot({ bay, drive, isSelected, onClick, size = 'sm' }) {
  const { setNodeRef, isOver } = useDroppable({ id: bay.id })

  const isEmpty = !drive
  const label = bay.label || `${bay.row + 1}-${bay.col + 1}`
  const style = drive ? slotStyle(drive.smart_status) : null

  return (
    <div
      ref={setNodeRef}
      onClick={() => onClick?.(bay)}
      className={clsx(
        'relative flex flex-col items-center justify-center rounded-xl border cursor-pointer transition-all duration-150 select-none group',
        SIZE_DIMS[size],
        isEmpty
          ? 'border-dashed border-slate-300 dark:border-gray-700/50 bg-slate-50 dark:bg-gray-900/20 hover:border-slate-400 dark:hover:border-gray-600/70 hover:bg-slate-100 dark:hover:bg-gray-800/20'
          : style.outer,
        isOver && '!border-blue-400 !bg-blue-50 dark:!bg-blue-950/40 ring-2 ring-blue-400/40',
        isSelected && '!border-blue-500/70 dark:!border-white/60 ring-2 ring-blue-400/20 dark:ring-white/20'
      )}
    >
      <span className="absolute top-1 left-1.5 text-[9px] text-slate-400 dark:text-gray-600 font-mono leading-none group-hover:text-slate-500 dark:group-hover:text-gray-500 transition-colors">
        {label}
      </span>

      {drive && (
        <span className={clsx(
          'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full shadow-sm',
          style.dot
        )} />
      )}

      {isEmpty ? (
        <span className="text-slate-400 dark:text-gray-700 text-lg mt-1">·</span>
      ) : (
        <>
          {(() => { const Icon = getDriveIcon(drive.form_factor, drive.rpm); return <Icon size={ICON_SIZE[size]} className={clsx('mt-0.5 transition-transform group-hover:scale-110', style.icon)} /> })()}
          <span className="text-[9px] text-slate-500 dark:text-gray-400 font-mono mt-1 px-1 truncate w-full text-center leading-none">
            {drive.serial?.slice(-6)}
          </span>
          {size !== 'sm' && drive.model && (
            <span className="text-[8px] text-slate-400 dark:text-gray-500 px-1 truncate w-full text-center leading-none mt-0.5">
              {drive.model}
            </span>
          )}
          {size === 'lg' && drive.capacity_bytes && (
            <span className="text-[8px] text-slate-400 dark:text-gray-600 text-center leading-none mt-0.5">
              {formatCapacity(drive.capacity_bytes)}
            </span>
          )}
          {drive.temperature_c != null && (
            <span className={clsx(
              'text-[8px] font-mono leading-none mt-0.5',
              drive.temperature_c >= 55 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-gray-600'
            )}>
              {drive.temperature_c}°
            </span>
          )}
        </>
      )}
    </div>
  )
}
