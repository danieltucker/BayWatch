import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { triggerScan } from '../api/client'

export default function ScanButton({ onScanComplete }) {
  const [scanning, setScanning] = useState(false)

  async function handleScan() {
    setScanning(true)
    try {
      await triggerScan()
      // Give backend a moment to run the background scan, then refresh
      setTimeout(() => {
        setScanning(false)
        onScanComplete?.()
      }, 3000)
    } catch {
      setScanning(false)
    }
  }

  return (
    <button
      onClick={handleScan}
      disabled={scanning}
      className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
      {scanning ? 'Scanning…' : 'Scan Drives'}
    </button>
  )
}
