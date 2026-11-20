import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import BaysPage from './pages/BaysPage'
import DriveDetail from './pages/DriveDetail'
import DrivesPage from './pages/DrivesPage'
import Reports from './pages/Reports'
import SearchPage from './pages/SearchPage'
import LogConsole from './components/LogConsole'
import SettingsModal from './components/SettingsModal'
import TabBar from './components/shell/TabBar'
import Toasts from './components/shell/Toasts'
import { ThemeProvider } from './context/ThemeContext'
import { TempThresholdProvider } from './context/TempThresholdContext'
import { FleetProvider, useFleet } from './context/FleetContext'
import { ShellContext } from './context/ShellContext'
import { getAlerts, triggerScan } from './api/client'

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem('dismissed-alerts') || '[]')) }
  catch { return new Set() }
}

function Shell() {
  const { refresh } = useFleet()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [dismissedIds, setDismissedIds] = useState(loadDismissed)

  const fetchAlerts = useCallback(async () => {
    try { setAlerts(await getAlerts(50)) } catch { /* API offline: keep last alerts */ }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, 30000)
    return () => clearInterval(id)
  }, [fetchAlerts])

  // Backtick toggles the log console (existing shortcut).
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

  const scan = useCallback(async () => {
    setScanning(true)
    setLogOpen(true)
    try {
      await triggerScan()
      setTimeout(() => { setScanning(false); refresh() }, 3000)
    } catch {
      setScanning(false)
    }
  }, [refresh])

  function dismissAlert(id) {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('dismissed-alerts', JSON.stringify([...next]))
      return next
    })
  }

  const undismissed = alerts.filter(a => !dismissedIds.has(a.id))
  const alertSeverity = undismissed.some(a => a.type === 'critical') ? 'critical' : undismissed.length ? 'status' : null

  const shell = useMemo(() => ({
    scan, scanning,
    openLog: () => setLogOpen(true),
    openSettings: () => setSettingsOpen(true),
    alertCount: undismissed.length, alertSeverity,
  }), [scan, scanning, undismissed.length, alertSeverity])

  return (
    <ShellContext.Provider value={shell}>
      {logOpen && <div className="fixed inset-0 z-[45]" onClick={() => setLogOpen(false)} />}
      <LogConsole open={logOpen} alerts={undismissed} onDismissAlert={dismissAlert} />
      <Routes>
        <Route path="/" element={<BaysPage />} />
        <Route path="/bays" element={<BaysPage />} />
        <Route path="/drives" element={<DrivesPage />} />
        <Route path="/drives/:serial" element={<DriveDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TabBar />
      <Toasts />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onUpdate={refresh} />
    </ShellContext.Provider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TempThresholdProvider>
        <FleetProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </FleetProvider>
      </TempThresholdProvider>
    </ThemeProvider>
  )
}
