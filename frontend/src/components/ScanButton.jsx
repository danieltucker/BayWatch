import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { triggerScan } from '../api/client'

export default function ScanButton({ onScanComplete, onOpenLog }) {
  const [scanning, setScanning] = useState(false)

  async function handleScan() {
    setScanning(true)
    onOpenLog?.()
    try {
      await triggerScan()
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
      className="wt-btn wt-btn--primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
      {scanning ? 'Scanning…' : 'Scan Drives'}
    </button>
  )
}
