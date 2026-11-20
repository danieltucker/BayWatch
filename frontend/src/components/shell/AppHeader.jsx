import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, HardDrive, RefreshCw, Search, Settings as SettingsIcon, X } from 'lucide-react'
import { useShell } from '../../context/ShellContext'
import { useFleet } from '../../context/FleetContext'
import { fmtRelative } from '../../lib/format'

export const APP_VERSION = '2.3.4'
const REPO_URL = 'https://github.com/danieltucker/BayWatch'

export const NAV = [
  { to: '/', label: 'Bays', match: p => p === '/' || p === '/bays' },
  { to: '/drives', label: 'Drives', match: p => p === '/drives' || p.startsWith('/drives/') },
  { to: '/reports', label: 'Reports', match: p => p === '/reports' },
]

export function Brand({ compact = false }) {
  return (
    <div className="bw-brand">
      <span className="wt-appicon" style={{ '--ai-size': compact ? '30px' : '34px', '--ai-from': 'var(--bw-from)', '--ai-to': 'var(--bw-to)' }}>
        <HardDrive strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span className="bw-brand__name">Bay<span>Watch</span></span>
      {!compact && (
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="bw-version bw-desktop-only">v{APP_VERSION}</a>
      )}
    </div>
  )
}

/**
 * Header search. By default it hands off to the Search page; the Bays page passes
 * `value`/`onChange` so typing dims non-matching bays in place (Enter still opens Search).
 */
function SearchField({ id = "bw-header-search", value, onChange, autoFocus, placeholder = 'Search serial, model, bay or pool' }) {
  const navigate = useNavigate()
  const [local, setLocal] = useState('')
  const controlled = onChange != null
  const v = controlled ? value : local
  return (
    <form
      role="search"
      className="bw-search"
      style={{ width: '100%' }}
      onSubmit={e => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(v.trim())}`) }}
    >
      <Search size={16} aria-hidden="true" />
      <label className="sr-only-bw" htmlFor={id}>Search drives, bays and pools</label>
      <input
        id={id} type="search" value={v} autoFocus={autoFocus} placeholder={placeholder} autoComplete="off"
        onChange={e => (controlled ? onChange(e.target.value) : setLocal(e.target.value))}
      />
      {v && (
        <button type="button" className="bw-iconbtn bw-iconbtn--sm" aria-label="Clear search"
          style={{ border: 0, background: 'transparent' }}
          onClick={() => (controlled ? onChange('') : setLocal(''))}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </form>
  )
}

function LiveIndicator() {
  const { lastRefreshed, drives } = useFleet()
  const worst = drives.some(d => d.smart_status === 'FAILED') ? 'down'
    : drives.some(d => d.is_connected !== false && (d.reallocated_sectors || d.pending_sectors || d.uncorrectable_errors)) ? 'warn' : 'up'
  if (!lastRefreshed) return null
  return (
    <span className="bw-live" title={lastRefreshed.toLocaleString()}>
      <span className={`bw-live__dot ${worst !== 'up' ? `bw-live__dot--${worst}` : ''}`} aria-hidden="true" />
      Updated {fmtRelative(lastRefreshed)}
    </span>
  )
}

export function AlertButton() {
  const { openLog, alertCount, alertSeverity } = useShell()
  const badge = alertSeverity === 'critical' ? 'var(--wt-down-500)' : alertSeverity ? 'var(--wt-warn-500)' : null
  return (
    <button type="button" className="bw-iconbtn" onClick={openLog}
      aria-label={alertCount ? `Notifications, ${alertCount} unread` : 'Notifications'}>
      <Bell size={18} aria-hidden="true" />
      {alertCount > 0 && <span className="bw-iconbtn__badge" style={{ background: badge }} aria-hidden="true" />}
    </button>
  )
}

export function ScanButton({ variant = 'primary', iconOnly = false, large = false }) {
  const { scan, scanning } = useShell()
  if (iconOnly) {
    return (
      <button type="button" className="bw-iconbtn" onClick={scan} disabled={scanning} aria-label={scanning ? 'Scanning drives' : 'Scan drives'}
        style={{ background: 'var(--wt-brand-600)', borderColor: 'var(--wt-brand-600)', color: '#fff' }}>
        <RefreshCw size={18} className={scanning ? 'animate-spin' : ''} aria-hidden="true" />
      </button>
    )
  }
  return (
    <button type="button" onClick={scan} disabled={scanning}
      className={`wt-btn wt-btn--${variant} ${large ? 'bw-btn-lg' : ''} disabled:opacity-60`}
      style={large ? undefined : { minHeight: 40 }}>
      <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} aria-hidden="true" />
      {scanning ? 'Scanning…' : 'Scan drives'}
    </button>
  )
}

/**
 * The family chrome for BayWatch: a dark band holding brand, primary nav, search and actions.
 * On the Bays page the hero is passed as children so it sits inside the same band.
 */
export default function AppHeader({ search, hideScan = false, children }) {
  const { openSettings } = useShell()
  const { pathname } = useLocation()
  const onSearchPage = pathname === '/search'
  return (
    <header className="bw-band" data-screen-label="Header">
      <div className="bw-band__bar">
        <Brand />
        <nav aria-label="Primary" className="bw-nav bw-desktop-only">
          {NAV.map(n => (
            <Link key={n.to} to={n.to} aria-current={n.match(pathname) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="bw-desktop-only" style={{ flex: '1 1 260px', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
          <div style={{ width: '100%', maxWidth: 460 }}>
            <SearchField {...search} autoFocus={onSearchPage} />
          </div>
        </div>
        <div style={{ flex: 1 }} className="bw-mobile-only" />
        <div className="flex items-center gap-2">
          <span className="bw-desktop-only hidden 2xl:inline-flex"><LiveIndicator /></span>
          {!hideScan && <span className="bw-desktop-only"><ScanButton /></span>}
          {!onSearchPage && (
            <Link to="/search" className="bw-iconbtn bw-mobile-only" aria-label="Search drives">
              <Search size={18} aria-hidden="true" />
            </Link>
          )}
          <AlertButton />
          <button type="button" className="bw-iconbtn" onClick={openSettings} aria-label="Settings">
            <SettingsIcon size={18} aria-hidden="true" />
          </button>
          <span className="bw-mobile-only"><ScanButton iconOnly /></span>
        </div>
      </div>
      {onSearchPage && (
        <div className="bw-mobile-only" style={{ padding: '0 8px 8px' }}>
          <SearchField {...search} id="bw-header-search-m" autoFocus />
        </div>
      )}
      {children}
    </header>
  )
}
