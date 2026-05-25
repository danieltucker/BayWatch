import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Save, Server, Upload, CheckCircle2, AlertCircle, X, Bell, Sun, Moon, Monitor, Pencil, Download, Settings2, Key, Globe, Copy, RefreshCw, ToggleLeft, ToggleRight, ChevronLeft } from 'lucide-react'
import {
  getEnclosures, createEnclosure, updateEnclosure, deleteEnclosure,
  createBayArray, deleteBayArray, updateBayArray,
  getAlertConfig, updateAlertConfig,
  importCSV,
  getApiKeys, createApiKey, deleteApiKey,
  getFederationTargets, createFederationTarget, updateFederationTarget, deleteFederationTarget, syncFederationTarget,
} from '../api/client'
import { useTheme } from '../context/ThemeContext'

const TABS = [
  { key: 'general',       label: 'General',       icon: Settings2, description: 'Console behavior and preferences' },
  { key: 'enclosures',    label: 'Enclosures',     icon: Server,    description: 'Manage enclosures and bay arrays' },
  { key: 'notifications', label: 'Notifications',  icon: Bell,      description: 'Telegram alerts and thresholds' },
  { key: 'api_keys',      label: 'API Keys',       icon: Key,       description: 'Generate keys for external API access' },
  { key: 'federation',    label: 'Federation',     icon: Globe,     description: 'Connect remote DriveMap instances' },
  { key: 'import',        label: 'Import',         icon: Upload,    description: 'Bulk import drive inventory from CSV' },
  { key: 'appearance',    label: 'Appearance',     icon: Sun,       description: 'Theme and display preferences' },
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
  const [tab, setTab] = useState('general')
  const [mobileShowContent, setMobileShowContent] = useState(false)
  const [tildeOverride, setTildeOverride] = useState(
    () => localStorage.getItem('console-tilde-override') === 'true'
  )
  const [enclosures, setEnclosures] = useState([])
  const [newEnc, setNewEnc] = useState({ name: '', type: 'server' })
  const [editingEnc, setEditingEnc] = useState(null)
  const [newArray, setNewArray] = useState({})
  const [alertForm, setAlertForm] = useState({
    bot_token: '', chat_id: '', status_frequency: 'disabled',
    critical_enabled: true, warranty_warning_days: 90,
    temp_warn_threshold_c: 55, temp_alert_threshold_c: 60, log_level: 'INFO',
  })
  const [alertSaved, setAlertSaved] = useState(false)
  const [editingArray, setEditingArray] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const { theme, setTheme } = useTheme()

  // ── API Keys state ──
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState(null)
  const [confirmRegenerateKeyId, setConfirmRegenerateKeyId] = useState(null)
  const [keyCopied, setKeyCopied] = useState(false)
  const [copiedRowId, setCopiedRowId] = useState(null)
  const [keyError, setKeyError] = useState(null)

  // ── Federation state ──
  const [fedTargets, setFedTargets] = useState([])
  const [newTarget, setNewTarget] = useState({ name: '', url: '', api_key: '', sync_interval_minutes: 15 })
  const [confirmDeleteTargetId, setConfirmDeleteTargetId] = useState(null)
  const [addingTarget, setAddingTarget] = useState(false)
  const [syncingTargetId, setSyncingTargetId] = useState(null)

  async function load() {
    const [encs, cfg] = await Promise.all([getEnclosures(), getAlertConfig()])
    setEnclosures(encs)
    setAlertForm(f => ({
      ...f,
      status_frequency: cfg.status_frequency,
      critical_enabled: cfg.critical_enabled,
      warranty_warning_days: cfg.warranty_warning_days,
      temp_warn_threshold_c: cfg.temp_warn_threshold_c ?? 55,
      temp_alert_threshold_c: cfg.temp_alert_threshold_c ?? 60,
      log_level: cfg.log_level ?? 'INFO',
    }))
  }

  async function loadApiKeys() {
    try {
      const keys = await getApiKeys()
      setApiKeys(keys)
    } catch {}
  }

  async function loadFedTargets() {
    try {
      const targets = await getFederationTargets()
      setFedTargets(targets)
    } catch {}
  }

  useEffect(() => {
    if (open) {
      setMobileShowContent(false)
      load()
      loadApiKeys()
      loadFedTargets()
    }
  }, [open])

  async function handleGenerateKey(e) {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setGeneratingKey(true)
    setKeyError(null)
    try {
      const result = await createApiKey(newKeyName.trim())
      sessionStorage.setItem(`apikey-${result.id}`, result.key)
      setGeneratedKey(result)
      setNewKeyName('')
      await loadApiKeys()
    } catch {
      setKeyError('Key generation failed — check the app logs.')
      await loadApiKeys()
    } finally {
      setGeneratingKey(false)
    }
  }

  async function handleDeleteKey(id) {
    await deleteApiKey(id)
    sessionStorage.removeItem(`apikey-${id}`)
    setConfirmDeleteKeyId(null)
    await loadApiKeys()
  }

  async function handleRegenerateKey(key) {
    setConfirmRegenerateKeyId(null)
    setKeyError(null)
    try {
      await deleteApiKey(key.id)
      sessionStorage.removeItem(`apikey-${key.id}`)
      const result = await createApiKey(key.name)
      sessionStorage.setItem(`apikey-${result.id}`, result.key)
      setGeneratedKey(result)
      await loadApiKeys()
    } catch {
      setKeyError('Regenerate failed — check the app logs.')
      await loadApiKeys()
    }
  }

  function copyRowKey(id, fallback) {
    const key = sessionStorage.getItem(`apikey-${id}`) || fallback
    if (!key) return
    navigator.clipboard.writeText(key)
    setCopiedRowId(id)
    setTimeout(() => setCopiedRowId(null), 2000)
  }

  async function handleAddTarget(e) {
    e.preventDefault()
    if (!newTarget.name.trim() || !newTarget.url.trim() || !newTarget.api_key.trim()) return
    setAddingTarget(true)
    try {
      await createFederationTarget(newTarget)
      setNewTarget({ name: '', url: '', api_key: '', sync_interval_minutes: 15 })
      await loadFedTargets()
    } finally {
      setAddingTarget(false)
    }
  }

  async function handleToggleTarget(target) {
    await updateFederationTarget(target.id, { enabled: !target.enabled })
    await loadFedTargets()
  }

  async function handleSyncTarget(id) {
    setSyncingTargetId(id)
    try {
      await syncFederationTarget(id)
      setTimeout(loadFedTargets, 1500)
    } finally {
      setSyncingTargetId(null)
    }
  }

  async function handleDeleteTarget(id) {
    await deleteFederationTarget(id)
    setConfirmDeleteTargetId(null)
    await loadFedTargets()
  }

  function relTimeAgo(dateStr) {
    if (!dateStr) return 'Never'
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

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

  async function handleSaveArray() {
    if (!editingArray) return
    const { enclosureId, arrayId, name, rows, cols, group_type, purpose } = editingArray
    await updateBayArray(enclosureId, arrayId, {
      name, rows: parseInt(rows), cols: parseInt(cols), group_type, purpose: purpose || null,
    })
    setEditingArray(null)
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
    const rows = [
      CSV_HEADERS.join(','),
      '"1-1","sda","Seagate","IronWolf Pro 16TB","ST16000NE000","16 TB","2022-03-15","Amazon","3 years","Primary NAS array"',
      '"1-2","sdb","Western Digital","WD Red Plus 8TB","WD8003FFBX","8 TB","2021-11-01","B&H Photo","","Replaced 2024-01"',
      '"","","Samsung","870 EVO 500GB","S4ABCDE12345","500 GB","","Newegg","2 years","Boot SSD - no bay assigned"',
    ]
    const csv = rows.join('\n') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'drivemap-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  const activeTab = TABS.find(t => t.key === tab) ?? TABS[0]

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-12 pointer-events-none">
        <div
          className="relative w-full max-w-3xl flex flex-row rounded-2xl bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden pointer-events-auto"
          style={{ height: 'min(680px, calc(100vh - 5rem))' }}
        >

          {/* ── Left nav sidebar ── */}
          <div className={`${mobileShowContent ? 'hidden md:flex' : 'flex'} w-full md:w-52 shrink-0 flex-col border-r border-slate-200 dark:border-gray-800 bg-slate-50/80 dark:bg-gray-900/80`}>
            <div className="px-4 pt-5 pb-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Settings</p>
            </div>
            <div className="h-px bg-slate-200 dark:bg-gray-800" />
            <nav className="flex-1 overflow-y-auto py-1.5">
              {TABS.map(t => {
                const Icon = t.icon
                const isActive = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTab(t.key); setMobileShowContent(true) }}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left rounded-none ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-slate-600 dark:text-gray-400 hover:bg-white/70 dark:hover:bg-gray-800/50 hover:text-slate-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    {t.label}
                  </button>
                )
              })}
            </nav>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-gray-800">
              <p className="text-[10px] text-slate-300 dark:text-gray-700">DriveMap v1.4.0</p>
            </div>
          </div>

          {/* ── Right content panel ── */}
          <div className={`${mobileShowContent ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>

            {/* Panel header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200 dark:border-gray-800 shrink-0">
              <button
                onClick={() => setMobileShowContent(false)}
                className="md:hidden flex items-center gap-0.5 text-sm text-blue-500 hover:text-blue-400 transition-colors shrink-0 mr-1 -ml-1"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{activeTab.label}</h2>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 truncate">{activeTab.description}</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-200 transition-colors p-1 rounded shrink-0 ml-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* ── General ── */}
              {tab === 'general' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-gray-300">Tilde always opens/closes console</p>
                      <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">
                        When on, the ~ key toggles the console even when an input field is focused.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !tildeOverride
                        setTildeOverride(next)
                        localStorage.setItem('console-tilde-override', String(next))
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                        tildeOverride ? 'bg-blue-600' : 'bg-slate-200 dark:bg-gray-700'
                      }`}
                      role="switch"
                      aria-checked={tildeOverride}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
                          tildeOverride ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Enclosures ── */}
              {tab === 'enclosures' && (
                <div className="flex flex-col gap-4">
                  {enclosures.map(enc => (
                    <div key={enc.id} className="rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-4 flex flex-col gap-3">
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
                          <button onClick={() => handleSaveEnclosure(enc.id)} className="text-blue-500 hover:text-blue-400 p-1"><Save size={15} /></button>
                          <button onClick={() => setEditingEnc(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 p-1"><X size={15} /></button>
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
                            >
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteEnclosure(enc.id)} className="text-red-400 hover:text-red-300 p-1">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )}

                      {enc.arrays.map(arr => (
                        <div key={arr.id} className="pl-2 border-l border-slate-300 dark:border-gray-700">
                          {editingArray?.arrayId === arr.id ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input value={editingArray.name}
                                  onChange={e => setEditingArray(f => ({ ...f, name: e.target.value }))}
                                  className="flex-1 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="Array name" />
                                <input type="number" min="1" value={editingArray.rows}
                                  onChange={e => setEditingArray(f => ({ ...f, rows: e.target.value }))}
                                  className="w-16 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="Rows" />
                                <input type="number" min="1" value={editingArray.cols}
                                  onChange={e => setEditingArray(f => ({ ...f, cols: e.target.value }))}
                                  className="w-16 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="Cols" />
                              </div>
                              <div className="flex items-center gap-2">
                                <select value={editingArray.group_type}
                                  onChange={e => setEditingArray(f => ({ ...f, group_type: e.target.value }))}
                                  className="flex-1 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none">
                                  {GROUP_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                </select>
                                <input value={editingArray.purpose}
                                  onChange={e => setEditingArray(f => ({ ...f, purpose: e.target.value }))}
                                  className="flex-1 rounded bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-1 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="Purpose (optional)" />
                                <button onClick={handleSaveArray} className="text-blue-500 hover:text-blue-400 p-1"><Save size={15} /></button>
                                <button onClick={() => setEditingArray(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 p-1"><X size={15} /></button>
                              </div>
                              {(parseInt(editingArray.rows) < arr.rows || parseInt(editingArray.cols) < arr.cols) && (
                                <p className="text-[10px] text-amber-500 dark:text-amber-400">
                                  Reducing grid size will remove out-of-bounds bays and their drive assignments.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
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
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setEditingArray({
                                    enclosureId: enc.id, arrayId: arr.id,
                                    name: arr.name, rows: arr.rows, cols: arr.cols,
                                    group_type: arr.group_type || 'drive_bays', purpose: arr.purpose || '',
                                  })}
                                  className="text-slate-400 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400 p-1 transition-colors"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => handleDeleteArray(enc.id, arr.id)} className="text-red-400 hover:text-red-300 p-1">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

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
                            {GROUP_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
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
                    <Field label="Temperature warning threshold (°C) — amber" type="number"
                      value={alertForm.temp_warn_threshold_c}
                      onChange={v => setAlertForm(f => ({ ...f, temp_warn_threshold_c: parseInt(v) || 55 }))} />
                    <Field label="Temperature danger threshold (°C) — red" type="number"
                      value={alertForm.temp_alert_threshold_c}
                      onChange={v => setAlertForm(f => ({ ...f, temp_alert_threshold_c: parseInt(v) || 60 }))} />
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-slate-500 dark:text-gray-400">Log Level</label>
                      <div className="flex gap-2">
                        {LOG_LEVELS.map(level => (
                          <button key={level} type="button"
                            onClick={() => setAlertForm(f => ({ ...f, log_level: level }))}
                            className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                              alertForm.log_level === level
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-100 dark:bg-gray-800 border-slate-300 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700'
                            }`}
                          >{level}</button>
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

              {/* ── API Keys ── */}
              {tab === 'api_keys' && (
                <div className="flex flex-col gap-5">
                  <p className="text-sm text-slate-500 dark:text-gray-500">
                    Generate API keys to access drive data programmatically via the <span className="font-mono text-xs">/v1/</span> endpoints.
                    Keys are shown once on creation; copy them immediately. Use Regenerate to get a new key for an existing entry.
                  </p>

                  {/* Generate form */}
                  <form onSubmit={handleGenerateKey} className="flex items-center gap-2">
                    <input
                      placeholder="Key name (e.g. Grafana, Home Assistant)"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      className="flex-1 rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={generatingKey || !newKeyName.trim()}
                      className="flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white shrink-0"
                    >
                      <Key size={14} /> Generate
                    </button>
                  </form>

                  {/* Newly generated key */}
                  {generatedKey && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/20 p-4 flex flex-col gap-3">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        Copy this key now — it won't be shown again after you leave this tab
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg px-3 py-2 text-slate-800 dark:text-gray-200 break-all">
                          {generatedKey.key}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(generatedKey.key)
                            setKeyCopied(true)
                            setTimeout(() => setKeyCopied(false), 2000)
                          }}
                          className="shrink-0 p-2 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Copy to clipboard"
                        >
                          {keyCopied ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                        </button>
                      </div>
                      <button
                        onClick={() => setGeneratedKey(null)}
                        className="text-xs text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400 self-end"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Error banner */}
                  {keyError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-700/40 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle size={14} className="shrink-0" />
                      {keyError}
                    </div>
                  )}

                  {/* Key list */}
                  {apiKeys.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-gray-600 text-center py-6">No API keys yet</p>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-800">
                            <th className="text-left px-3 py-2 text-xs text-slate-500 dark:text-gray-500 font-medium">Name</th>
                            <th className="text-left px-3 py-2 text-xs text-slate-500 dark:text-gray-500 font-medium">Key</th>
                            <th className="text-left px-3 py-2 text-xs text-slate-500 dark:text-gray-500 font-medium whitespace-nowrap">Created</th>
                            <th className="text-left px-3 py-2 text-xs text-slate-500 dark:text-gray-500 font-medium whitespace-nowrap">Last used</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.map(k => {
                            const sessionKey = sessionStorage.getItem(`apikey-${k.id}`)
                            const displayKey = sessionKey || `${k.key_prefix}…`
                            return (
                              <tr key={k.id} className="border-b border-slate-100 dark:border-gray-800/60 last:border-0">
                                <td className="px-3 py-2.5 text-slate-800 dark:text-gray-200 text-sm whitespace-nowrap">{k.name}</td>
                                <td className="px-3 py-2.5 max-w-[180px]">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <code className="font-mono text-xs text-slate-500 dark:text-gray-400 truncate flex-1">{displayKey}</code>
                                    <button
                                      onClick={() => copyRowKey(k.id, displayKey)}
                                      className="shrink-0 p-1 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                      title={sessionKey ? 'Copy key' : 'Copy prefix'}
                                    >
                                      {copiedRowId === k.id
                                        ? <CheckCircle2 size={13} className="text-green-500" />
                                        : <Copy size={13} />}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-400 dark:text-gray-600 whitespace-nowrap">{new Date(k.created_at).toLocaleDateString()}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-400 dark:text-gray-600 whitespace-nowrap">{k.last_used_at ? relTimeAgo(k.last_used_at) : '—'}</td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center gap-0.5 justify-end">
                                    {!sessionKey && (
                                      confirmRegenerateKeyId === k.id ? (
                                        <span className="flex items-center gap-1 mr-1">
                                          <button onClick={() => handleRegenerateKey(k)} className="text-xs text-amber-500 hover:text-amber-400 font-medium">Regen</button>
                                          <button onClick={() => setConfirmRegenerateKeyId(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">✕</button>
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmRegenerateKeyId(k.id)}
                                          className="p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                                          title="Regenerate key (old key stops working)"
                                        >
                                          <RefreshCw size={13} />
                                        </button>
                                      )
                                    )}
                                    {confirmDeleteKeyId === k.id ? (
                                      <span className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-500 dark:text-gray-500">Delete?</span>
                                        <button onClick={() => handleDeleteKey(k.id)} className="text-xs text-red-500 hover:text-red-400 font-medium">Yes</button>
                                        <button onClick={() => setConfirmDeleteKeyId(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">No</button>
                                      </span>
                                    ) : (
                                      <button onClick={() => setConfirmDeleteKeyId(k.id)} className="text-slate-400 hover:text-red-400 p-1 transition-colors">
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Federation ── */}
              {tab === 'federation' && (
                <div className="flex flex-col gap-5">
                  <p className="text-sm text-slate-500 dark:text-gray-500">
                    Add remote DriveMap instances to aggregate their drive data here. Each target needs an API key generated on the remote instance.
                  </p>

                  <form onSubmit={handleAddTarget} className="rounded-xl border border-slate-200 dark:border-gray-800 p-4 flex flex-col gap-3 bg-slate-50 dark:bg-gray-900/40">
                    <p className="text-xs font-medium text-slate-600 dark:text-gray-400 uppercase tracking-wider">Add Target</p>
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Name (e.g. JBOD Shelf)"
                        value={newTarget.name}
                        onChange={e => setNewTarget(t => ({ ...t, name: e.target.value }))}
                        className="flex-1 rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={newTarget.sync_interval_minutes}
                        onChange={e => setNewTarget(t => ({ ...t, sync_interval_minutes: Number(e.target.value) }))}
                        className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-2 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none"
                      >
                        <option value={5}>5 min</option>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                    <input
                      placeholder="URL (e.g. http://192.168.1.50:8585)"
                      value={newTarget.url}
                      onChange={e => setNewTarget(t => ({ ...t, url: e.target.value }))}
                      className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="password"
                      placeholder="API key (dm_…)"
                      value={newTarget.api_key}
                      onChange={e => setNewTarget(t => ({ ...t, api_key: e.target.value }))}
                      className="rounded-md bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-700 px-3 py-2 text-sm text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={addingTarget || !newTarget.name.trim() || !newTarget.url.trim() || !newTarget.api_key.trim()}
                      className="flex items-center gap-1.5 self-end rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
                    >
                      <Plus size={14} /> Add Target
                    </button>
                  </form>

                  {fedTargets.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-gray-600 text-center py-6">No federation targets configured</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {fedTargets.map(t => (
                        <div key={t.id} className="rounded-xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${t.enabled ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-gray-700'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 dark:text-gray-200 truncate">{t.name}</p>
                              <p className="text-xs font-mono text-slate-400 dark:text-gray-600 truncate">{t.url}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleToggleTarget(t)}
                                className={`p-1 rounded transition-colors ${t.enabled ? 'text-emerald-500 hover:text-emerald-400' : 'text-slate-400 dark:text-gray-600 hover:text-slate-600 dark:hover:text-gray-400'}`}
                                title={t.enabled ? 'Disable' : 'Enable'}
                              >
                                {t.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                              </button>
                              <button
                                onClick={() => handleSyncTarget(t.id)}
                                disabled={syncingTargetId === t.id}
                                className="p-1 rounded text-slate-400 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                title="Sync now"
                              >
                                <RefreshCw size={14} className={syncingTargetId === t.id ? 'animate-spin' : ''} />
                              </button>
                              {confirmDeleteTargetId === t.id ? (
                                <span className="flex items-center gap-1.5">
                                  <button onClick={() => handleDeleteTarget(t.id)} className="text-xs text-red-500 hover:text-red-400 font-medium">Delete</button>
                                  <button onClick={() => setConfirmDeleteTargetId(null)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-gray-300">Cancel</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmDeleteTargetId(t.id)} className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-gray-600">
                            <span>Sync: every {t.sync_interval_minutes}m</span>
                            <span>Last: {relTimeAgo(t.last_synced_at)}</span>
                            {t.last_error && (
                              <span className="text-red-400 dark:text-red-500 truncate" title={t.last_error}>
                                ⚠ {t.last_error.slice(0, 60)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Auto follows your system preference.</p>
                  </div>
                </div>
              )}

            </div>
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
