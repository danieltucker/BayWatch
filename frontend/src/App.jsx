import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HardDrive, Settings as SettingsIcon, Bell } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import DriveDetail from './pages/DriveDetail'
import LogConsole from './components/LogConsole'
import { ThemeProvider } from './context/ThemeContext'
import { TempThresholdProvider } from './context/TempThresholdContext'
import { getAlerts } from './api/client'

const APP_VERSION = '2.2.1'
const REPO_URL = 'https://github.com/danieltucker/BayWatch'

function Nav({ onSettings, onBell, alertCount, alertSeverity }) {
  const bellColor =
    alertSeverity === 'critical' ? 'text-[--wt-down-500]' :
    alertSeverity === 'status'   ? 'text-[--wt-warn-500]' :
    'text-[--wt-text-faint]'

  const badgeColor =
    alertSeverity === 'critical' ? 'bg-[--wt-down-500]' :
    alertSeverity === 'status'   ? 'bg-[--wt-warn-500]' :
    'bg-[--wt-brand-500]'

  return (
    <nav className="wt-appbar sticky top-0 z-40 justify-between">
      <div className="flex items-center gap-2.5">
        <span
          className="wt-appicon"
          style={{ '--ai-size': '30px', '--ai-from': 'var(--bw-from)', '--ai-to': 'var(--bw-to)' }}
        >
          <HardDrive size={14} strokeWidth={2.5} />
        </span>
        <span className="font-bold tracking-tight" style={{ color: 'var(--wt-text)', fontSize: 'var(--wt-text-md)' }}>
          Bay<span style={{ color: 'var(--bw-ink)' }}>Watch</span>
        </span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="wt-chip wt-chip--plain"
          style={{ textDecoration: 'none' }}
        >
          v{APP_VERSION}
        </a>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onBell}
          className="wt-btn wt-btn--ghost relative"
          title="Notifications"
        >
          <Bell size={15} className={bellColor} />
          {alertCount > 0 && (
            <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${badgeColor}`} />
          )}
        </button>
        <button onClick={onSettings} className="wt-btn wt-btn--ghost">
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
        const override = localStorage.getItem('console-tilde-override') !== 'false'
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
        <div className="min-h-screen">
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
