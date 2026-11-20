import { Link, useLocation } from 'react-router-dom'
import { BarChart3, HardDrive, LayoutGrid } from 'lucide-react'
import { NAV } from './AppHeader'

const ICONS = { '/': LayoutGrid, '/drives': HardDrive, '/reports': BarChart3 }

/** Bottom tab bar for the small-viewport layout. Hidden above the mobile breakpoint by CSS. */
export default function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Primary" className="bw-tabbar bw-mobile-only">
      {NAV.map(n => {
        const Icon = ICONS[n.to]
        return (
          <Link key={n.to} to={n.to} aria-current={n.match(pathname) ? 'page' : undefined}>
            <Icon size={20} aria-hidden="true" />
            {n.label}
          </Link>
        )
      })}
    </nav>
  )
}
