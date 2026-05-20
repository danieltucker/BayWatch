import clsx from 'clsx'
import { useDroppable } from '@dnd-kit/core'
import { HardDrive } from 'lucide-react'

function smartColor(status) {
  if (status === 'PASSED') return 'border-green-700 bg-green-950/40'
  if (status === 'FAILED') return 'border-red-600 bg-red-950/60'
  return 'border-gray-600 bg-gray-800/60'
}

export default function BaySlot({ bay, drive, isSelected, onClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: bay.id })

  const isEmpty = !drive
  const label = bay.label || `${bay.row + 1}-${bay.col + 1}`

  return (
    <div
      ref={setNodeRef}
      onClick={() => onClick?.(bay)}
      className={clsx(
        'relative flex flex-col items-center justify-center rounded-lg border-2 cursor-pointer transition-all select-none',
        'w-16 h-16 sm:w-20 sm:h-20',
        isEmpty
          ? 'border-dashed border-gray-700 bg-gray-900/40 hover:border-gray-500'
          : smartColor(drive?.smart_status),
        isOver && 'ring-2 ring-blue-400 border-blue-400',
        isSelected && 'ring-2 ring-white'
      )}
    >
      <span className="absolute top-1 left-1.5 text-[10px] text-gray-500 font-mono leading-none">
        {label}
      </span>

      {isEmpty ? (
        <span className="text-gray-600 text-xs mt-2">—</span>
      ) : (
        <>
          <HardDrive size={18} className={clsx(
            'mt-1',
            drive.smart_status === 'FAILED' ? 'text-red-400' : 'text-green-400'
          )} />
          <span className="text-[9px] text-gray-300 font-mono mt-0.5 px-1 truncate w-full text-center">
            {drive.serial?.slice(-6)}
          </span>
          {drive.temperature_c != null && (
            <span className={clsx(
              'text-[9px] font-mono',
              drive.temperature_c >= 55 ? 'text-yellow-400' : 'text-gray-500'
            )}>
              {drive.temperature_c}°
            </span>
          )}
        </>
      )}
    </div>
  )
}
