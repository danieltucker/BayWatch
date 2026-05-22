import { createContext, useContext, useEffect, useState } from 'react'
import { getAlertConfig } from '../api/client'

const TempThresholdContext = createContext({ warnC: 55, dangerC: 60 })

export function TempThresholdProvider({ children }) {
  const [thresholds, setThresholds] = useState({ warnC: 55, dangerC: 60 })

  useEffect(() => {
    getAlertConfig()
      .then(cfg => setThresholds({
        warnC: cfg.temp_warn_threshold_c ?? 55,
        dangerC: cfg.temp_alert_threshold_c ?? 60,
      }))
      .catch(() => {})
  }, [])

  return (
    <TempThresholdContext.Provider value={thresholds}>
      {children}
    </TempThresholdContext.Provider>
  )
}

export function useTempThresholds() {
  return useContext(TempThresholdContext)
}
