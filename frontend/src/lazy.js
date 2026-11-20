// Code-split entry points. These pull in recharts (charts) or are only shown on demand,
// so they load when first opened instead of in the main bundle.
import { lazy } from 'react'

export const DriveCard = lazy(() => import('./components/DriveCard'))
export const DriveHistoryModal = lazy(() => import('./components/DriveHistoryModal'))
export const HealthBreakdownModal = lazy(() => import('./components/HealthBreakdownModal'))
export const PoolTopologyPanel = lazy(() => import('./components/PoolTopologyPanel'))
export const EmptyBayModal = lazy(() => import('./components/EmptyBayModal'))
export const SettingsModal = lazy(() => import('./components/SettingsModal'))
