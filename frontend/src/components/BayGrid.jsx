import { useState } from 'react'
import { DndContext, DragOverlay, useDraggable } from '@dnd-kit/core'
import { HardDrive } from 'lucide-react'
import BaySlot from './BaySlot'
import { assignDrive, unassignDrive } from '../api/client'

function DraggableDrive({ drive }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drive-${drive.serial}`,
    data: { serial: drive.serial },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-200">
        <HardDrive size={12} />
        <span className="font-mono">{drive.serial.slice(-8)}</span>
      </div>
    </div>
  )
}

export default function BayGrid({ array, bays, driveMap, selectedBayId, onBayClick, onAssignmentChange }) {
  const [activeDrive, setActiveDrive] = useState(null)

  const rows = array.rows
  const cols = array.cols

  // Build grid: bays indexed by "row-col"
  const bayGrid = {}
  for (const bay of bays) {
    bayGrid[`${bay.row}-${bay.col}`] = bay
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveDrive(null)
    if (!over) return

    const serial = active.data.current?.serial
    const bayId = over.id  // droppable id is bay.id (number)
    if (!serial || !bayId) return

    try {
      await assignDrive(bayId, serial)
      onAssignmentChange?.()
    } catch (e) {
      console.error('Assignment failed', e)
    }
  }

  return (
    <DndContext
      onDragStart={e => setActiveDrive(e.active.data.current?.serial)}
      onDragEnd={handleDragEnd}
    >
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">{array.name}</h3>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
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
                  isSelected={selectedBayId === bay.id}
                  onClick={onBayClick}
                />
              )
            })
          )}
        </div>
      </div>

      <DragOverlay>
        {activeDrive && (
          <div className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white shadow-lg">
            <HardDrive size={12} />
            <span className="font-mono">{activeDrive.slice(-8)}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
