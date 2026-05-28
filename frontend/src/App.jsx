import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HardDrive, Settings as SettingsIcon, Bell } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import DriveDetail from './pages/DriveDetail'
import LogConsole from './components/LogConsole'
import { ThemeProvider } from './context/ThemeContext'
import { TempThresholdProvider } from './context/TempThresholdContext'
import { getAlerts } from './api/client'

function Nav({ onSettings, onBell, alertCount, alertSeverity }) {
  const bellColor =
    alertSeverity === 'critical' ? 'text-red-500 dark:text-red-400' :
    alertSeverity === 'status'   ? 'text-amber-500 dark:text-amber-400' :
    'text-slate-400 dark:text-gray-500'

  return (
    <nav className="flex items-center justify-between px-5 py-3 border-b border-slate-200/80 dark:border-gray-800/80 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/30">
          <HardDrive size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-slate-900 dark:text-white tracking-tight">
          Bay<span className="text-blue-500 dark:text-blue-400">Watch</span>
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onBell}
          className="relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-colors"
          title="Notifications"
        >
          <Bell size={15} className={bellColor} />
          {alertCount > 0 && (
            <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
              alertSeverity === 'critical' ? 'bg-red-500' :
              alertSeverity === 'status'   ? 'bg-amber-500' :
              'bg-blue-500'
            }`} />
          )}
        </button>
        <button
          onClick={onSettings}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800/60 transition-colors"
        >
          <SettingsIcon size={15} /> Settings
        </button>
      </div>
    </nav>
  )
}

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem('dismissed-alerts') || '[]')) }
  catch { return new Set() }
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [dismissedIds, setDismissedIds] = useState(loadDismissed)

  const fetchAlerts = useCallback(async () => {
    try { setAlerts(await getAlerts(50)) } catch {}
  }, [])

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, 30000)
    return () => clearInterval(id)
  }, [fetchAlerts])

  useEffect(() => {
    function onKey(e) {
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName
        const override = localStorage.getItem('console-tilde-override') === 'true'
        if (!override && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return
        e.preventDefault()
        setLogOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function dismissAlert(id) {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('dismissed-alerts', JSON.stringify([...next]))
      return next
    })
  }

  const undismissed = alerts.filter(a => !dismissedIds.has(a.id))
  const alertSeverity =
    undismissed.some(a => a.type === 'critical') ? 'critical' :
    undismissed.length > 0 ? 'status' : null

  return (
    <ThemeProvider>
      <TempThresholdProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100">
          {logOpen && (
            <div
              className="fixed inset-0 z-[45]"
              onClick={() => setLogOpen(false)}
            />
          )}
          <LogConsole
            open={logOpen}
            alerts={undismissed}
            onDismissAlert={dismissAlert}
          />
          <Nav
            onSettings={() => setSettingsOpen(true)}
            onBell={() => setLogOpen(true)}
            alertCount={undismissed.length}
            alertSeverity={alertSeverity}
          />
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
      </TempThresholdProvider>
    </ThemeProvider>
  )
}
