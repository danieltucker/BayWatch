import { useState } from 'react'
import clsx from 'clsx'
import BaySlot from './BaySlot'

const SIZES = ['sm', 'md', 'lg']
const SLOT_PX = { sm: 72, md: 88, lg: 108 }

export default function BayGrid({ array, bays, driveMap, selectedBayId, onBayClick }) {
  const storageKey = `array-size-${array.id}`
  const [size, setSize] = useState(() => localStorage.getItem(storageKey) || 'sm')

  const rows = array.rows
  const cols = array.cols

  const bayGrid = {}
  for (const bay of bays) {
    bayGrid[`${bay.row}-${bay.col}`] = bay
  }

  function handleSize(s) {
    setSize(s)
    localStorage.setItem(storageKey, s)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-gray-300">{array.name}</h3>
        <div className="flex rounded-md border border-slate-200 dark:border-gray-700/60 overflow-hidden">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => handleSize(s)}
              className={clsx(
                'px-2 py-0.5 text-[10px] font-medium transition-colors',
                size === s
                  ? 'bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200'
                  : 'text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400'
              )}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, ${SLOT_PX[size]}px)` }}
      >
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const bay = bayGrid[`${r}-${c}`]
            if (!bay) return <div key={`${r}-${c}`} />
            const drive = bay.drive_serial ? driveMap[bay.drive_serial] : null
            return (
              <BaySlot
                key={bay.id}
                bay={bay}
                drive={drive}
                size={size}
                isSelected={selectedBayId === bay.id}
                onClick={onBayClick}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
