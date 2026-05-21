import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Save, Server, Upload, CheckCircle2, AlertCircle, X, Bell, Sun, Moon, Monitor, Pencil, Download, Thermometer } from 'lucide-react'
import {
  getEnclosures, createEnclosure, updateEnclosure, deleteEnclosure,
  createBayArray, deleteBayArray,
  getAlertConfig, updateAlertConfig,
  importCSV,
} from '../api/client'
import { useTheme } from '../context/ThemeContext'

const TABS = [
  { key: 'enclosures', label: 'Enclosures', icon: Server },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'import', label: 'Import', icon: Upload },
  { key: 'appearance', label: 'Appearance', icon: Sun },
]

const GROUP_TYPES = [
  { value: 'drive_bays', label: 'Drive Bays' },
  { value: 'zfs_pool', label: 'ZFS Pool' },
  { value: 'zfs_mirror', label: 'ZFS Mirror' },
  { value: 'zfs_raidz1', label: 'ZFS RAIDZ1' },
  { value: 'zfs_raidz2', label: 'ZFS RAIDZ2' },
  { value: 'hardware_raid', label: 'HW RAID' },
  { value: 'pcie_slots', label: 'PCIe Slots' },
  { value: 'standalone', label: 'Standalone' },
  { value: 'other', label: 'Other' },
]

const GROUP_TYPE_LABEL = Object.fromEntries(GROUP_TYPES.map(g => [g.value, g.label]))

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR']

const CSV_HEADERS = ['Position', 'Dev Name', 'Make', 'Model', 'Serial', 'Size', 'Mfg Date', 'Source', 'Warranty', 'Notes']

export default function SettingsModal({ open, onClose, onUpdate }) {
  const [tab, setTab] = useState('enclosures')
  const [enclosures, setEnclosures] = useState([])
  const [newEnc, setNewEnc] = useState({ name: '', type: 'server' })
  const [editingEnc, setEditingEnc] = useState(null)
  const [newArray, setNewArray] = useState({})
  const [alertForm, setAlertForm] = useState({
    bot_token: '', chat_id: '', status_frequency: 'disabled',
    critical_enabled: true, warranty_warning_days: 90,
    temp_alert_threshold_c: 55, log_level: 'INFO',
  })
  const [alertSaved, setAlertSaved] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const { theme, setTheme } = useTheme()

  async function load() {
    const [encs, cfg] = await Promise.all([getEnclosures(), getAlertConfig()])
    setEnclosures(encs)
    setAlertForm(f => ({
      ...f,
      status_frequency: cfg.status_frequency,
      critical_enabled: cfg.critical_enabled,
      warranty_warning_days: cfg.warranty_warning_days,
      temp_alert_threshold_c: cfg.temp_alert_threshold_c ?? 55,
      log_level: cfg.log_level ?? 'INFO',
    }))
  }

  useEffect(() => { if (open) load() }, [open])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleAddEnclosure(e) {
    e.preventDefault()
    if (!newEnc.name.trim()) return
    await createEnclosure(newEnc)
    setNewEnc({ name: '', type: 'server' })
    load(); onUpdate?.()
  }

  async function handleSaveEnclosure(id) {
    if (!editingEnc || editingEnc.id !== id) return
    await updateEnclosure(id, { name: editingEnc.name, type: editingEnc.type, description: editingEnc.description })
    setEditingEnc(null)
    load(); onUpdate?.()
  }

  async function handleDeleteEnclosure(id) {
    if (!confirm('Delete this enclosure and all its bay arrays?')) return
    await deleteEnclosure(id)
    load(); onUpdate?.()
  }

  function arrayDefaults(enclosureId) {
    return newArray[enclosureId] || { name: '', rows: '', cols: '', group_type: 'drive_bays', purpose: '' }
  }

  function setArrayField(enclosureId, field, value) {
    setNewArray(m => ({ ...m, [enclosureId]: { ...arrayDefaults(enclosureId), [field]: value } }))
  }

  async function handleAddArray(enclosureId) {
    const data = arrayDefaults(enclosureId)
    if (!data.name || !data.rows || !data.cols) return
    await createBayArray(enclosureId, {
      name: data.name,
      rows: parseInt(data.rows),
      cols: parseInt(data.cols),
      display_order: 0,
      group_type: data.group_type || 'drive_bays',
      purpose: data.purpose || null,
    })
    setNewArray(m => ({ ...m, [enclosureId]: { name: '', rows: '', cols: '', group_type: 'drive_bays', purpose: '' } }))
    load(); onUpdate?.()
  }

  async function handleDeleteArray(enclosureId, arrayId) {
    if (!confirm('Delete this bay array? Bay assignments will be lost.')) return
    await deleteBayArray(enclosureId, arrayId)
    load(); onUpdate?.()
  }

  async function handleSaveAlerts(e) {
    e.preventDefault()
    await updateAlertConfig(alertForm)
    setAlertSaved(true)
    setTimeout(() => setAlertSaved(false), 2000)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportResult(null); setImportError(null)
    try {
      setImportResult(await importCSV(file))
    } catch (err) {
      setImportError(err.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleDownloadTemplate() {
    const csv = CSV_HEADERS.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'drivemap-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="relative w-full max-w-2xl flex flex-col rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800 shrink-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Settings</h2>
            <button onClick={onClose} className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded">
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-gray-800 shrink-0 px-5">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    tab === t.key
                      ? 'border-blue-500 text-blue-500 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* ── Enclosures ── */}
            {tab === 'enclosures' && (
              <div className="flex flex-col gap-4">
                {enclosures.map(enc => (
                  <div key={enc.id} className="rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-4 flex flex-col gap-3">
                    {/* Enclosure header */}
                    {editingEnc?.id === enc.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={editingEnc.name}
                          onChange={e => setEditingEnc(f => ({ ...f, name: e.target.value }))}
                          className="flex-1 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <select
                          value={editingEnc.type}
                          onChange={e => setEditingEnc(f => ({ ...f, type: e.target.value }))}
                          className="rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none"
                        >
                          <option value="server">Server</option>
                          <option value="jbod">JBOD</option>
                          <option value="other">Other</option>
                        </select>
                        <button onClick={() => handleSaveEnclosure(enc.id)} className="text-blue-500 hover:text-blue-400 p-1">
                          <Save size={15} />
                        </button>
                        <button onClick={() => setEditingEnc(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 p-1">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">{enc.name}</span>
                          <span className="ml-2 text-xs text-slate-500 dark:text-gray-500 capitalize">{enc.type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingEnc({ id: enc.id, name: enc.name, type: enc.type, description: enc.description || '' })}
                            className="text-slate-400 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400 p-1 transition-colors"
                            title="Edit enclosure"
                          >
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteEnclosure(enc.id)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Array list */}
                    {enc.arrays.map(arr => (
                      <div key={arr.id} className="flex items-center justify-between pl-2 border-l border-slate-300 dark:border-gray-700">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-slate-600 dark:text-gray-300 truncate">
                            {arr.name} <span className="text-slate-400 dark:text-gray-500">({arr.rows}×{arr.cols})</span>
                          </span>
                          {arr.group_type && arr.group_type !== 'drive_bays' && (
                            <span className="text-[10px] text-slate-400 dark:text-gray-600 bg-slate-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full shrink-0">
                              {GROUP_TYPE_LABEL[arr.group_type] || arr.group_type}
                            </span>
                          )}
                          {arr.purpose && (
                            <span className="text-[10px] text-slate-400 dark:text-gray-600 truncate hidden sm:block">{arr.purpose}</span>
                          )}
                        </div>
                        <button onClick={() => handleDeleteArray(enc.id, arr.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Add array form */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-slate-200 dark:border-gray-700/60">
                      <div className="flex items-center gap-2">
                        <input placeholder="Array name" value={arrayDefaults(enc.id).name}
                          onChange={e => setArrayField(enc.id, 'name', e.target.value)}
                          className="flex-1 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input type="number" placeholder="Rows" min="1" value={arrayDefaults(enc.id).rows}
                          onChange={e => setArrayField(enc.id, 'rows', e.target.value)}
                          className="w-16 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <input type="number" placeholder="Cols" min="1" value={arrayDefaults(enc.id).cols}
                          onChange={e => setArrayField(enc.id, 'cols', e.target.value)}
                          className="w-16 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={arrayDefaults(enc.id).group_type}
                          onChange={e => setArrayField(enc.id, 'group_type', e.target.value)}
                          className="flex-1 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none">
                          {GROUP_TYPES.map(g => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                        <input placeholder="Purpose / notes (optional)" value={arrayDefaults(enc.id).purpose}
                          onChange={e => setArrayField(enc.id, 'purpose', e.target.value)}
                          className="flex-1 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <button onClick={() => handleAddArray(enc.id)}
                          className="flex items-center gap-1 rounded bg-blue-700 hover:bg-blue-600 px-3 py-1 text-sm text-white shrink-0">
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <form onSubmit={handleAddEnclosure} className="flex items-center gap-2">
                  <input placeholder="Enclosure name" value={newEnc.name}
                    onChange={e => setNewEnc(f => ({ ...f, name: e.target.value }))}
                    className="flex-1 rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <select value={newEnc.type} onChange={e => setNewEnc(f => ({ ...f, type: e.target.value }))}
                    className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none">
                    <option value="server">Server</option>
                    <option value="jbod">JBOD</option>
                    <option value="other">Other</option>
                  </select>
                  <button type="submit"
                    className="flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white">
                    <Plus size={16} /> Add
                  </button>
                </form>
              </div>
            )}

            {/* ── Notifications ── */}
            {tab === 'notifications' && (
              <form onSubmit={handleSaveAlerts} className="flex flex-col gap-4">
                <p className="text-sm text-slate-500 dark:text-gray-500">Telegram bot alerts for SMART failures, overtemp, and warranty warnings.</p>
                <Field label="Bot Token" type="password" value={alertForm.bot_token}
                  onChange={v => setAlertForm(f => ({ ...f, bot_token: v }))}
                  placeholder="Leave blank to keep existing" />
                <Field label="Chat ID" type="text" value={alertForm.chat_id}
                  onChange={v => setAlertForm(f => ({ ...f, chat_id: v }))}
                  placeholder="Your Telegram chat ID" />
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-slate-500 dark:text-gray-400">Status Report Frequency</label>
                  <select value={alertForm.status_frequency}
                    onChange={e => setAlertForm(f => ({ ...f, status_frequency: e.target.value }))}
                    className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none">
                    <option value="disabled">Disabled</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly (Monday)</option>
                    <option value="monthly">Monthly (1st)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="critical" checked={alertForm.critical_enabled}
                    onChange={e => setAlertForm(f => ({ ...f, critical_enabled: e.target.checked }))}
                    className="rounded" />
                  <label htmlFor="critical" className="text-sm text-slate-600 dark:text-gray-300">
                    Immediate critical alerts (SMART failure, overtemp, reallocated sectors)
                  </label>
                </div>

                <div className="border-t border-slate-200 dark:border-gray-800 pt-4 flex flex-col gap-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase tracking-widest">Thresholds</p>
                  <Field label="Warranty warning (days before expiry)" type="number"
                    value={alertForm.warranty_warning_days}
                    onChange={v => setAlertForm(f => ({ ...f, warranty_warning_days: parseInt(v) || 90 }))} />
                  <Field label="Temperature alert threshold (°C)" type="number"
                    value={alertForm.temp_alert_threshold_c}
                    onChange={v => setAlertForm(f => ({ ...f, temp_alert_threshold_c: parseInt(v) || 55 }))} />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm text-slate-500 dark:text-gray-400">Log Level</label>
                    <div className="flex gap-2">
                      {LOG_LEVELS.map(level => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setAlertForm(f => ({ ...f, log_level: level }))}
                          className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                            alertForm.log_level === level
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button type="submit"
                    className="flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white">
                    <Save size={14} /> Save
                  </button>
                  {alertSaved && <span className="text-sm text-green-500 dark:text-green-400">Saved!</span>}
                </div>
              </form>
            )}

            {/* ── Import ── */}
            {tab === 'import' && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  Upload a CSV with columns:{' '}
                  <span className="font-mono text-slate-700 dark:text-gray-300 text-xs">
                    {CSV_HEADERS.join(', ')}
                  </span>
                  . Serial is required. Position matches an existing bay label.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 rounded-md bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 border border-slate-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 transition-colors"
                  >
                    <Download size={14} /> Download Template
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport}
                    className="hidden" id="csv-upload" />
                  <label htmlFor="csv-upload"
                    className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
                      importing ? 'bg-slate-200 dark:bg-gray-700 text-slate-400 dark:text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}>
                    <Upload size={14} />
                    {importing ? 'Importing…' : 'Choose CSV'}
                  </label>
                </div>
                {importResult && (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/40 p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      <CheckCircle2 size={15} /> Import complete
                    </div>
                    <p className="text-xs text-slate-600 dark:text-gray-300">
                      {importResult.imported} new &nbsp;·&nbsp; {importResult.updated} updated &nbsp;·&nbsp; {importResult.assigned} assigned
                    </p>
                    {importResult.skipped.length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs text-amber-500 dark:text-amber-400 mb-1">{importResult.skipped.length} row(s) skipped:</p>
                        <ul className="text-xs text-slate-500 dark:text-gray-500 space-y-0.5 pl-2">
                          {importResult.skipped.map((s, i) => (
                            <li key={i}>Row {s.row}{s.serial ? ` (${s.serial})` : ''}: {s.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {importError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-700/40 p-3 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle size={15} /> {importError}
                  </div>
                )}
              </div>
            )}

            {/* ── Appearance ── */}
            {tab === 'appearance' && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Theme</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'light', label: 'Light', Icon: Sun },
                      { value: 'dark', label: 'Dark', Icon: Moon },
                      { value: 'auto', label: 'Auto', Icon: Monitor },
                    ].map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          theme === value
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon size={14} /> {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                    Auto follows your system preference.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-slate-500 dark:text-gray-400">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>
  )
}
