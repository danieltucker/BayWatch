import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  getLogs, getDrives, getDrive, getProfile, patchDrive,
  getEnclosures, getBays, assignDrive, unassignDrive, triggerScan,
} from '../api/client'

const ALL_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
const DEFAULT_LEVELS = new Set(['INFO', 'WARNING', 'ERROR', 'CRITICAL'])

const LEVEL_COLOR = {
  DEBUG: 'text-gray-600',
  INFO: 'text-green-400',
  WARNING: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-500',
}

const LEVEL_BTN_ON = {
  DEBUG: 'bg-gray-800 text-gray-300 border-gray-600',
  INFO: 'bg-green-950 text-green-400 border-green-700',
  WARNING: 'bg-amber-950 text-amber-400 border-amber-700',
  ERROR: 'bg-red-950 text-red-400 border-red-700',
}

const LEVEL_BTN_OFF = 'text-gray-700 border-gray-800 hover:text-gray-500'

const COMMANDS = {
  help:     'help [cmd]                       — list commands or show usage',
  drives:   'drives                           — list all drives',
  drive:    'drive <serial>                   — show full details for a drive',
  find:     'find <query>                     — search drives by model/make/serial',
  scan:     'scan                             — trigger a drive scan',
  edit:     'edit <serial> <field> <value>    — edit drive field (make, model, form_factor, rpm)',
  profile:  'profile <serial>                 — show drive profile (warranty, purchase info)',
  bays:     'bays                             — list all enclosures and bay assignments',
  assign:   'assign <serial> <bay-label>      — assign drive to a bay',
  unassign: 'unassign <bay-label>             — remove drive assignment from a bay',
  logs:     'logs [level]                     — toggle a log level filter',
  clear:    'clear                            — clear console output',
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, '')
}

export default function LogConsole({ open, alerts = [], onDismissAlert }) {
  const [entries, setEntries] = useState([])
  const [activeLevels, setActiveLevels] = useState(new Set(DEFAULT_LEVELS))
  const [cmdInput, setCmdInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const lastIdRef = useRef(0)
  const bottomRef = useRef(null)
  const intervalRef = useRef(null)
  const inputRef = useRef(null)
  const syntheticId = useRef(0)

  useEffect(() => {
    if (!open) { clearInterval(intervalRef.current); return }

    async function poll() {
      try {
        const fresh = await getLogs(lastIdRef.current)
        if (fresh.length > 0) {
          lastIdRef.current = fresh[fresh.length - 1].id
          setEntries(prev => [...prev.slice(-450), ...fresh.map(e => ({ ...e, type: 'log' }))])
        }
      } catch {}
    }

    poll()
    intervalRef.current = setInterval(poll, 1000)
    return () => clearInterval(intervalRef.current)
  }, [open])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [entries, open])

  function nextId() { return `s${++syntheticId.current}` }

  function addOut(text) {
    setEntries(prev => [...prev, { id: nextId(), type: 'out', text }])
  }

  function addErr(text) {
    setEntries(prev => [...prev, { id: nextId(), type: 'err', text }])
  }

  function toggleLevel(level) {
    setActiveLevels(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  async function executeCommand(raw) {
    const input = raw.trim()
    if (!input) return
    setEntries(prev => [...prev, { id: nextId(), type: 'cmd', text: input }])
    setCmdHistory(h => [input, ...h.slice(0, 49)])
    setHistoryIdx(-1)
    setCmdInput('')

    const parts = input.split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    try {
      switch (cmd) {
        case 'help':     execHelp(args); break
        case 'drives':   await execDrives(); break
        case 'drive':    await execDrive(args); break
        case 'find':     await execFind(args); break
        case 'scan':     await execScan(); break
        case 'edit':     await execEdit(args); break
        case 'profile':  await execProfile(args); break
        case 'bays':     await execBays(); break
        case 'assign':   await execAssign(args); break
        case 'unassign': await execUnassign(args); break
        case 'logs':     execLogs(args); break
        case 'clear':    setEntries([]); break
        default:         addErr(`Unknown command: ${cmd}. Type 'help' for a list.`)
      }
    } catch (err) {
      addErr(`Error: ${err.response?.data?.detail || err.message}`)
    }
  }

  function execHelp(args) {
    if (args.length) {
      const name = args[0].toLowerCase()
      if (COMMANDS[name]) { addOut(COMMANDS[name]); return }
      addErr(`Unknown command: ${name}`)
      return
    }
    addOut('Commands:')
    Object.values(COMMANDS).forEach(d => addOut(`  ${d}`))
  }

  async function execDrives() {
    const drives = await getDrives()
    if (!drives.length) { addOut('No drives found.'); return }
    addOut(`${drives.length} drive(s):`)
    drives.forEach(d => {
      const s = d.smart_status === 'PASSED' ? '✓' : d.smart_status === 'FAILED' ? '✗' : '?'
      addOut(`  [${s}] ${d.serial.padEnd(20)} ${(d.model || '—').padEnd(20)} ${d.device_path || ''}`)
    })
  }

  async function execDrive(args) {
    if (!args[0]) { addErr('Usage: drive <serial>'); return }
    const d = await getDrive(args[0])
    const rows = [
      ['Serial', d.serial],
      ['Model', d.model || '—'],
      ['Make', d.make || '—'],
      ['Form factor', d.form_factor || '—'],
      ['Type', d.rpm === 0 ? 'SSD' : d.rpm ? `HDD ${d.rpm}rpm` : '—'],
      ['Firmware', d.firmware_version || '—'],
      ['Capacity', d.capacity_bytes ? `${(d.capacity_bytes / 1e12).toFixed(2)} TB` : '—'],
      ['SMART', d.smart_status],
      ['Temp', d.temperature_c != null ? `${d.temperature_c}°C` : '—'],
      ['Power-on', d.power_on_hours != null ? `${d.power_on_hours.toLocaleString()}h` : '—'],
      ['Reallocated', d.reallocated_sectors ?? '—'],
      ['Pending', d.pending_sectors ?? '—'],
      ['Device', d.device_path || '—'],
    ]
    rows.forEach(([k, v]) => addOut(`  ${k.padEnd(14)} ${v}`))
  }

  async function execFind(args) {
    if (!args.length) { addErr('Usage: find <query>'); return }
    const q = args.join(' ').toLowerCase()
    const drives = await getDrives()
    const matches = drives.filter(d =>
      d.serial?.toLowerCase().includes(q) ||
      d.model?.toLowerCase().includes(q) ||
      d.make?.toLowerCase().includes(q) ||
      d.device_path?.toLowerCase().includes(q) ||
      d.firmware_version?.toLowerCase().includes(q)
    )
    if (!matches.length) { addOut(`No matches for "${args.join(' ')}"`); return }
    addOut(`${matches.length} match(es):`)
    matches.forEach(d => addOut(`  ${d.serial.padEnd(20)} ${d.model || '—'}`))
  }

  async function execScan() {
    addOut('Triggering scan…')
    await triggerScan()
    addOut('Scan started. Watch logs above for progress.')
  }

  async function execEdit(args) {
    if (args.length < 3) { addErr('Usage: edit <serial> <field> <value>'); return }
    const [serial, field, ...rest] = args
    const allowed = ['make', 'model', 'form_factor', 'rpm']
    if (!allowed.includes(field)) {
      addErr(`Editable fields: ${allowed.join(', ')}`); return
    }
    const value = rest.join(' ')
    const patch = { [field]: field === 'rpm' ? (value === 'null' ? null : parseInt(value)) : (value || null) }
    await patchDrive(serial, patch)
    addOut(`Updated ${field} on ${serial}`)
  }

  async function execProfile(args) {
    if (!args[0]) { addErr('Usage: profile <serial>'); return }
    const p = await getProfile(args[0])
    const warranty = p.warranty_months != null ? `${(p.warranty_months / 12).toFixed(1)} yrs` : '—'
    const expiry = p.warranty_expiry
      ? `${p.warranty_expiry}${p.warranty_days_remaining != null
          ? ` (${p.warranty_days_remaining > 0 ? `${Math.round(p.warranty_days_remaining / 30)}mo left` : 'expired'})`
          : ''}`
      : '—'
    const rows = [
      ['Serial', p.serial],
      ['Purchase', p.purchase_date || '—'],
      ['Warranty', warranty],
      ['Expires', expiry],
      ['Price', p.purchase_price != null ? `$${p.purchase_price}` : '—'],
      ['Vendor', p.vendor || '—'],
      ['Notes', p.notes || '—'],
    ]
    rows.forEach(([k, v]) => addOut(`  ${k.padEnd(10)} ${v}`))
  }

  async function execBays() {
    const encs = await getEnclosures()
    if (!encs.length) { addOut('No enclosures configured. Go to Settings to add one.'); return }
    for (const enc of encs) {
      addOut(`${enc.name} (${enc.type})`)
      for (const arr of enc.arrays) {
        addOut(`  ${arr.name}  ${arr.rows}×${arr.cols}`)
        const bays = await getBays(arr.id)
        bays.forEach(b => {
          const label = (b.label || `${b.row + 1}-${b.col + 1}`).padEnd(8)
          addOut(`    ${label} ${b.drive_serial || '(empty)'}`)
        })
      }
    }
  }

  async function findBayByLabel(label) {
    const encs = await getEnclosures()
    for (const enc of encs) {
      for (const arr of enc.arrays) {
        const bays = await getBays(arr.id)
        const found = bays.find(b =>
          (b.label || `${b.row + 1}-${b.col + 1}`).toLowerCase() === label.toLowerCase()
        )
        if (found) return found
      }
    }
    return null
  }

  async function execAssign(args) {
    if (args.length < 2) { addErr('Usage: assign <serial> <bay-label>'); return }
    const [serial, label] = args
    addOut(`Looking up bay "${label}"…`)
    const bay = await findBayByLabel(label)
    if (!bay) { addErr(`No bay with label "${label}" found.`); return }
    await assignDrive(bay.id, serial)
    addOut(`Assigned ${serial} to bay ${label}`)
  }

  async function execUnassign(args) {
    if (!args[0]) { addErr('Usage: unassign <bay-label>'); return }
    addOut(`Looking up bay "${args[0]}"…`)
    const bay = await findBayByLabel(args[0])
    if (!bay) { addErr(`No bay with label "${args[0]}" found.`); return }
    await unassignDrive(bay.id)
    addOut(`Unassigned bay ${args[0]}`)
  }

  function execLogs(args) {
    if (!args.length) {
      addOut(`Active levels: ${[...activeLevels].join(', ') || 'none (all hidden)'}`)
      return
    }
    const level = args[0].toUpperCase()
    if (!ALL_LEVELS.includes(level)) {
      addErr(`Unknown level: ${level}. Valid: ${ALL_LEVELS.join(', ')}`); return
    }
    toggleLevel(level)
    const next = new Set(activeLevels)
    if (next.has(level)) next.delete(level); else next.add(level)
    addOut(`${level} ${next.has(level) ? 'hidden' : 'visible'}`)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { executeCommand(cmdInput); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(historyIdx + 1, cmdHistory.length - 1)
      if (idx >= 0) { setHistoryIdx(idx); setCmdInput(cmdHistory[idx]) }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = historyIdx - 1
      if (idx < 0) { setHistoryIdx(-1); setCmdInput(''); return }
      setHistoryIdx(idx); setCmdInput(cmdHistory[idx])
    }
  }

  const visible = entries.filter(e =>
    e.type !== 'log' || activeLevels.has(e.level)
  )

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        open ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ height: '50vh' }}
    >
      <div className="h-full flex flex-col bg-[#0a0f0a] border-b-2 border-green-900/50 shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900/60 border-b border-gray-800/60 shrink-0 gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]" />
            <span className="text-xs font-mono text-green-500 font-bold tracking-widest uppercase">
              DriveMap Console
            </span>
          </div>

          {/* Level filter buttons */}
          <div className="flex items-center gap-1">
            {['DEBUG', 'INFO', 'WARNING', 'ERROR'].map(level => {
              const on = activeLevels.has(level)
              return (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-medium transition-colors ${
                    on ? LEVEL_BTN_ON[level] : LEVEL_BTN_OFF
                  }`}
                >
                  {level === 'WARNING' ? 'WARN' : level}
                </button>
              )
            })}
          </div>

          <span className="text-[10px] text-gray-700 font-mono shrink-0">` to close</span>
        </div>

        {/* Pinned notifications */}
        {alerts.length > 0 && (
          <div className="shrink-0 border-b border-gray-800/60 px-3 py-2 flex flex-col gap-1 max-h-[30%] overflow-y-auto">
            <span className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-0.5">Notifications</span>
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`flex items-start gap-2 rounded px-2 py-1 ${
                  alert.type === 'critical'
                    ? 'bg-red-950/50 border border-red-900/50'
                    : 'bg-amber-950/40 border border-amber-900/40'
                }`}
              >
                <span className={`text-[9px] font-mono font-bold shrink-0 mt-0.5 ${
                  alert.type === 'critical' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {alert.type.toUpperCase()}
                </span>
                <span className={`text-[10px] font-mono flex-1 leading-relaxed ${
                  alert.type === 'critical' ? 'text-red-300' : 'text-amber-300'
                }`}>
                  {stripHtml(alert.message)}
                </span>
                <button
                  onClick={() => onDismissAlert?.(alert.id)}
                  className="text-gray-700 hover:text-gray-400 shrink-0 transition-colors mt-0.5"
                  title="Dismiss"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Log output */}
        <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs">
          {visible.length === 0 ? (
            <span className="text-gray-700">— no output. trigger a scan or type a command below —</span>
          ) : (
            visible.map(e => {
              if (e.type === 'cmd') return (
                <div key={e.id} className="flex gap-2 leading-5 mt-1">
                  <span className="text-cyan-500 shrink-0">$</span>
                  <span className="text-cyan-300">{e.text}</span>
                </div>
              )
              if (e.type === 'out') return (
                <div key={e.id} className="leading-5 text-gray-400 pl-3">{e.text}</div>
              )
              if (e.type === 'err') return (
                <div key={e.id} className="leading-5 text-red-400 pl-3">{e.text}</div>
              )
              return (
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
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Command input */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-800/60 bg-gray-950/40 shrink-0">
          <span className="text-green-500 font-mono text-xs shrink-0">$</span>
          <input
            ref={inputRef}
            value={cmdInput}
            onChange={e => setCmdInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="type a command — 'help' to list all"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent font-mono text-xs text-green-300 outline-none placeholder-gray-700 caret-green-400"
          />
        </div>
      </div>
    </div>
  )
}
