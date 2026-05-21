export default function WarningBadge({ status, days }) {
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">
        FAILED
      </span>
    )
  }
  if (days !== undefined && days !== null) {
    if (days < 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">
          Warranty expired
        </span>
      )
    }
    if (days <= 90) {
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-amber-100 dark:bg-yellow-900 text-amber-700 dark:text-yellow-200">
          {days}d left
        </span>
      )
    }
  }
  if (status === 'PASSED') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200">
        OK
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-slate-200 dark:bg-gray-700 text-slate-500 dark:text-gray-400">
      UNKNOWN
    </span>
  )
}
