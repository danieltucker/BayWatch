import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  getEnclosures, getDrives, getBays, getAllProfiles, getPools, getPoolTopology, getFederationData,
} from '../api/client'
import { buildLocations, placementIndex } from '../lib/fleet'
import { driveName } from '../lib/format'

const FleetContext = createContext(null)

const REFRESH_MS = 5 * 60 * 1000

/**
 * Loads everything the screens need once and shares it across routes:
 * enclosures + bays, drives, profiles, pools, topology and federated snapshots.
 */
export function FleetProvider({ children }) {
  const [state, setState] = useState({
    loading: true, error: null, enclosures: [], drives: [], baysMap: {}, profiles: [],
    pools: [], topology: [], federation: [], lastRefreshed: null,
  })
  const [toasts, setToasts] = useState([])
  const prevConnected = useRef(null)

  const pushToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, ...toast }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 8000)
  }, [])
  const dismissToast = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), [])

  const refresh = useCallback(async () => {
    try {
      const [enclosures, drives, pools, topology, federation, profiles] = await Promise.all([
        getEnclosures(), getDrives(),
        getPools().catch(() => []), getPoolTopology().catch(() => []),
        getFederationData().catch(() => []), getAllProfiles().catch(() => []),
      ])
      const arrayIds = enclosures.flatMap(e => e.arrays.map(a => a.id))
      const bayLists = await Promise.all(arrayIds.map(id => getBays(id).catch(() => [])))
      const baysMap = Object.fromEntries(arrayIds.map((id, i) => [id, bayLists[i]]))

      if (prevConnected.current) {
        for (const d of drives) {
          if (d.is_connected === false && prevConnected.current.get(d.serial) === true) {
            pushToast({ tone: 'warn', title: driveName(d), body: 'Drive no longer detected' })
          }
        }
      }
      prevConnected.current = new Map(drives.map(d => [d.serial, d.is_connected !== false]))

      setState({
        loading: false, error: null, enclosures, drives, baysMap, profiles, pools, topology, federation,
        lastRefreshed: new Date(),
      })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e?.message || 'Could not reach the BayWatch API' }))
    }
  }, [pushToast])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  const derived = useMemo(() => {
    const driveMap = Object.fromEntries(state.drives.map(d => [d.serial, d]))
    const profileMap = Object.fromEntries(state.profiles.map(p => [p.serial, p]))
    const locations = buildLocations({ enclosures: state.enclosures, baysMap: state.baysMap, driveMap, federation: state.federation })
    const placement = placementIndex(locations)
    const bayBySerial = Object.fromEntries(Object.entries(placement).map(([s, p]) => [s, p.bay]))
    return { driveMap, profileMap, locations, placement, bayBySerial }
  }, [state.drives, state.profiles, state.enclosures, state.baysMap, state.federation])

  const value = useMemo(
    () => ({ ...state, ...derived, refresh, toasts, pushToast, dismissToast }),
    [state, derived, refresh, toasts, pushToast, dismissToast],
  )
  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}

export function useFleet() {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet must be used inside <FleetProvider>')
  return ctx
}
