import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HardDrive, Settings as SettingsIcon } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import DriveDetail from './pages/DriveDetail'
import SettingsModal from './components/SettingsModal'
import LogConsole from './components/LogConsole'

function Nav({ onSettings }) {
  return (
    <nav className="flex items-center justify-between px-5 py-3 border-b border-gray-800/80 bg-gray-950/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30">
          <HardDrive size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-white tracking-tight">
          Drive<span className="text-blue-400">Map</span>
        </span>
      </div>
      <button
        onClick={onSettings}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
      >
        <SettingsIcon size={15} /> Settings
      </button>
    </nav>
  )
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  useEffect(() => {
    function onKey(e) {
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Don't toggle if typing in an input/textarea
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        setLogOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <LogConsole open={logOpen} />
        <Nav onSettings={() => setSettingsOpen(true)} />
        <Routes>
          <Route path="/" element={
            <Dashboard onOpenLog={() => setLogOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
          } />
          <Route path="/drives/:serial" element={<DriveDetail />} />
        </Routes>
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </BrowserRouter>
  )
}
