import { useEffect, useRef, useState } from 'react'
import { getLogs } from '../api/client'

const LEVEL_COLOR = {
  DEBUG: 'text-gray-600',
  INFO: 'text-green-400',
  WARNING: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500',
}

export default function LogConsole({ open }) {
  const [entries, setEntries] = useState([])
  const lastIdRef = useRef(0)
  const bottomRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!open) {
      clearInterval(intervalRef.current)
      return
    }

    async function poll() {
      try {
        const fresh = await getLogs(lastIdRef.current)
        if (fresh.length > 0) {
          lastIdRef.current = fresh[fresh.length - 1].id
          setEntries(prev => [...prev.slice(-450), ...fresh])
        }
      } catch {}
    }

    poll()
    intervalRef.current = setInterval(poll, 1000)
    return () => clearInterval(intervalRef.current)
  }, [open])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, open])

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        open ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ height: '42vh' }}
    >
      <div className="h-full flex flex-col bg-[#0a0f0a] border-b-2 border-green-900/50 shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900/60 border-b border-gray-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]" />
            <span className="text-xs font-mono text-green-500 font-bold tracking-widest uppercase">
              DriveMap Console
            </span>
          </div>
          <span className="text-[10px] text-gray-700 font-mono">backtick ` to close</span>
        </div>

        {/* Log output */}
        <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs">
          {entries.length === 0 ? (
            <span className="text-gray-700">— no output yet. trigger a scan to see logs —</span>
          ) : (
            entries.map(e => (
              <div key={e.id} className="flex gap-3 leading-5 hover:bg-white/[0.02] px-1 rounded">
                <span className="text-gray-700 shrink-0 tabular-nums">
                  {new Date(e.ts * 1000).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 w-14 ${LEVEL_COLOR[e.level] ?? 'text-gray-400'}`}>
                  {e.level}
                </span>
                <span className="text-gray-600 shrink-0 max-w-[140px] truncate">{e.logger}</span>
                <span className={LEVEL_COLOR[e.level] ?? 'text-gray-300'}>{e.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
