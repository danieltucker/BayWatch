import { createContext, useContext } from 'react'

/** App chrome actions shared by every page: scan, log console, settings, alert state. */
export const ShellContext = createContext({
  scan: () => {}, scanning: false, openLog: () => {}, openSettings: () => {},
  alertCount: 0, alertSeverity: null,
})

export const useShell = () => useContext(ShellContext)
