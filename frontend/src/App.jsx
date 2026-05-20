import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { HardDrive, LayoutDashboard, Settings as SettingsIcon } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import DriveDetail from './pages/DriveDetail'
import Settings from './pages/Settings'

function Nav() {
  const base = 'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors'
  const active = 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30'
  const inactive = 'text-gray-400 hover:text-white hover:bg-gray-800/60'

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
      <div className="flex items-center gap-1">
        <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
          <LayoutDashboard size={15} /> Map
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
          <SettingsIcon size={15} /> Settings
        </NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Nav />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/drives/:serial" element={<DriveDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
