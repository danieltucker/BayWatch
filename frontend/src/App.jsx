import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Settings as SettingsIcon } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import DriveDetail from './pages/DriveDetail'
import Settings from './pages/Settings'

function Nav() {
  const base = 'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors'
  const active = 'bg-gray-800 text-white'
  const inactive = 'text-gray-400 hover:text-white hover:bg-gray-800/50'

  return (
    <nav className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-950">
      <span className="font-bold text-white tracking-tight">Drive Position</span>
      <div className="flex items-center gap-1">
        <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
          <LayoutDashboard size={16} /> Map
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
          <SettingsIcon size={16} /> Settings
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
