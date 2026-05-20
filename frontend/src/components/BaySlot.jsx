import clsx from 'clsx'
import { useDroppable } from '@dnd-kit/core'
import { HardDrive } from 'lucide-react'

function slotStyle(status) {
  if (status === 'PASSED') return {
    outer: 'border-emerald-700/60 bg-emerald-950/30 hover:border-emerald-500/80 hover:bg-emerald-950/50',
    icon: 'text-emerald-400',
    dot: 'bg-emerald-400 shadow-emerald-400/60',
  }
  if (status === 'FAILED') return {
    outer: 'border-red-600/70 bg-red-950/40 hover:border-red-500 hover:bg-red-950/60 animate-pulse',
    icon: 'text-red-400',
    dot: 'bg-red-400 shadow-red-400/60',
  }
  return {
    outer: 'border-gray-600/50 bg-gray-800/40 hover:border-gray-500/70',
    icon: 'text-gray-500',
    dot: 'bg-gray-500',
  }
}

export default function BaySlot({ bay, drive, isSelected, onClick }) {
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
        'w-16 h-16 sm:w-[72px] sm:h-[72px]',
        isEmpty
          ? 'border-dashed border-gray-700/50 bg-gray-900/20 hover:border-gray-600/70 hover:bg-gray-800/20'
          : style.outer,
        isOver && '!border-blue-400 !bg-blue-950/40 ring-2 ring-blue-400/40',
        isSelected && '!border-white/60 ring-2 ring-white/20'
      )}
    >
      {/* Bay label */}
      <span className="absolute top-1 left-1.5 text-[9px] text-gray-600 font-mono leading-none group-hover:text-gray-500 transition-colors">
        {label}
      </span>

      {/* Health dot */}
      {drive && (
        <span className={clsx(
          'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full shadow-sm',
          style.dot
        )} />
      )}

      {isEmpty ? (
        <span className="text-gray-700 text-lg mt-1">·</span>
      ) : (
        <>
          <HardDrive
            size={17}
            className={clsx('mt-0.5 transition-transform group-hover:scale-110', style.icon)}
          />
          <span className="text-[9px] text-gray-400 font-mono mt-1 px-1 truncate w-full text-center leading-none">
            {drive.serial?.slice(-6)}
          </span>
          {drive.temperature_c != null && (
            <span className={clsx(
              'text-[8px] font-mono leading-none mt-0.5',
              drive.temperature_c >= 55 ? 'text-amber-400' : 'text-gray-600'
            )}>
              {drive.temperature_c}°
            </span>
          )}
        </>
      )}
    </div>
  )
}
