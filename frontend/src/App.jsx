import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HardDrive, Settings as SettingsIcon } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import DriveDetail from './pages/DriveDetail'
import LogConsole from './components/LogConsole'
import { ThemeProvider } from './context/ThemeContext'

function Nav({ onSettings }) {
  return (
    <nav className="flex items-center justify-between px-5 py-3 border-b border-slate-200/80 dark:border-gray-800/80 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30">
          <HardDrive size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-slate-900 dark:text-white tracking-tight">
          Drive<span className="text-blue-500 dark:text-blue-400">Map</span>
        </span>
      </div>
      <button
        onClick={onSettings}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-colors"
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
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100">
          <LogConsole open={logOpen} />
          <Nav onSettings={() => setSettingsOpen(true)} />
          <Routes>
            <Route path="/" element={
              <Dashboard
                onOpenLog={() => setLogOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                settingsOpen={settingsOpen}
                onCloseSettings={() => setSettingsOpen(false)}
              />
            } />
            <Route path="/drives/:serial" element={<DriveDetail />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
