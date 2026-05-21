import { HardDrive, Cpu, MemoryStick, Server } from 'lucide-react'

/**
 * Returns the lucide icon component for a drive based on form factor and rpm.
 * rpm === 0 means SSD; null/undefined means unknown.
 */
export function getDriveIcon(formFactor, rpm) {
  if (formFactor === 'M.2') return MemoryStick
  if (formFactor === 'U.2') return Server
  if (rpm === 0 || formFactor === 'SSD') return Cpu
  return HardDrive
}
