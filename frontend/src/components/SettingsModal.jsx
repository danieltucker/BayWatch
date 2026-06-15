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
  { key: 'federation',    label: 'Federation',     icon: Globe,     description: 'Connect remote BayWatch instances' },
  { key: 'import',        label: 'Import',         icon: Upload,    description: 'Bulk import drive inventory from CSV' },
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
    () => localStorage.getItem('console-tilde-override') !== 'false'
  )
  const [enclosures, setEnclosures] = useState([])
  const [newEnc, setNewEnc] = useState({ name: '', type: 'server' })
  const [editingEnc, setEditingEnc] = useState(null)
  const [newArray, setNewArray] = useState({})
  const [alertForm, setAlertForm] = useState({
    bot_token: '', chat_id: '', status_frequency: 'disabled',
    critical_enabled: true, warranty_warning_days: 90,
    temp_warn_threshold_c: 55, temp_alert_threshold_c: 60, log_level: 'INFO',
    zfs_warn_threshold: 1, zfs_critical_threshold: 50,
  })
  const [alertSaved, setAlertSaved] = useState(false)
  const [editingArray, setEditingArray] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const { theme, setTheme } = useTheme()

  const [apiKeys, setApiKeys] = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState(null)
  const [confirmRegenerateKeyId, setConfirmRegenerateKeyId] = useState(null)
  const [keyCopied, setKeyCopied] = useState(false)
  const [copiedRowId, setCopiedRowId] = useState(null)
  const [keyError, setKeyError] = useState(null)

  const [fedTargets, setFedTargets] = useState([])
  const [newTarget, setNewTarget] = useState({ name: '', url: '', api_key: '', sync_interval_minutes: 15 })
  const [confirmDeleteTargetId, setConfirmDeleteTargetId] = useState(null)
  const [addingTarget, setAddingTarget] = useState(false)
  const [syncingTargetId, setSyncingTargetId] = useState(null)
  const [renamingTargetId, setRenamingTargetId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

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
      zfs_warn_threshold: cfg.zfs_warn_threshold ?? 1,
      zfs_critical_threshold: cfg.zfs_critical_threshold ?? 50,
    }))
  }

  async function loadApiKeys() {
    try { setApiKeys(await getApiKeys()) } catch {}
  }

  async function loadFedTargets() {
    try { setFedTargets(await getFederationTargets()) } catch {}
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
    setGeneratingKey(true); setKeyError(null)
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
    setConfirmRegenerateKeyId(null); setKeyError(null)
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

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
  }

  async function copyRowKey(id, fallback) {
    const key = sessionStorage.getItem(`apikey-${id}`) || fallback
    if (!key) return
    await copyToClipboard(key)
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
      await loadFedTargets(); onUpdate?.()
    } finally { setAddingTarget(false) }
  }

  async function handleToggleTarget(target) {
    await updateFederationTarget(target.id, { enabled: !target.enabled })
    await loadFedTargets(); onUpdate?.()
  }

  async function handleSyncTarget(id) {
    setSyncingTargetId(id)
    try {
      await syncFederationTarget(id)
      setTimeout(() => { loadFedTargets(); onUpdate?.() }, 1500)
    } finally { setSyncingTargetId(null) }
  }

  async function handleDeleteTarget(id) {
    await deleteFederationTarget(id)
    setConfirmDeleteTargetId(null)
    await loadFedTargets(); onUpdate?.()
  }

  async function handleRenameTarget(id) {
    const name = renameValue.trim()
    if (name) await updateFederationTarget(id, { name })
    setRenamingTargetId(null); setRenameValue('')
    await loadFedTargets(); onUpdate?.()
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
    setEditingEnc(null); load(); onUpdate?.()
  }

  async function handleDeleteEnclosure(id) {
    if (!confirm('Delete this enclosure and all its bay arrays?')) return
    await deleteEnclosure(id); load(); onUpdate?.()
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
      name: data.name, rows: parseInt(data.rows), cols: parseInt(data.cols),
      display_order: 0, group_type: data.group_type || 'drive_bays', purpose: data.purpose || null,
    })
    setNewArray(m => ({ ...m, [enclosureId]: { name: '', rows: '', cols: '', group_type: 'drive_bays', purpose: '' } }))
    load(); onUpdate?.()
  }

  async function handleDeleteArray(enclosureId, arrayId) {
    if (!confirm('Delete this bay array? Bay assignments will be lost.')) return
    await deleteBayArray(enclosureId, arrayId); load(); onUpdate?.()
  }

  async function handleSaveArray() {
    if (!editingArray) return
    const { enclosureId, arrayId, name, rows, cols, group_type, purpose } = editingArray
    await updateBayArray(enclosureId, arrayId, { name, rows: parseInt(rows), cols: parseInt(cols), group_type, purpose: purpose || null })
    setEditingArray(null); load(); onUpdate?.()
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
    try { setImportResult(await importCSV(file)) }
    catch (err) { setImportError(err.response?.data?.detail || 'Import failed') }
    finally {
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
    const blob = new Blob([rows.join('\n') + '\n'], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'baywatch-import-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  const activeTab = TABS.find(t => t.key === tab) ?? TABS[0]

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-12 pointer-events-none">
        <div className="relative w-full max-w-3xl flex flex-row rounded-2xl border shadow-2xl overflow-hidden pointer-events-auto"
          style={{ height: 'min(680px, calc(100vh - 5rem))', background: 'var(--wt-surface)', borderColor: 'var(--wt-border)' }}>

          {/* ── Left nav sidebar ── */}
          <div className={`${mobileShowContent ? 'hidden md:flex' : 'flex'} w-full md:w-52 shrink-0 flex-col`}
            style={{ borderRight: '1px solid var(--wt-border)', background: 'var(--wt-surface-2)' }}>
            <div className="px-4 pt-5 pb-3">
              <p className="wt-eyebrow">Settings</p>
            </div>
            <div style={{ height: 1, background: 'var(--wt-border)' }} />
            <nav className="flex-1 overflow-y-auto py-1.5">
              {TABS.map(t => {
                const Icon = t.icon
                const isActive = tab === t.key
                return (
                  <button key={t.key}
                    onClick={() => { setTab(t.key); setMobileShowContent(true) }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left"
                    style={isActive
                      ? { background: 'color-mix(in oklch, var(--wt-brand-500) 10%, transparent)', color: 'var(--wt-brand-500)', fontWeight: 500 }
                      : { color: 'var(--wt-text-muted)' }
                    }
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--wt-surface-3)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
                  >
                    <Icon size={15} className="shrink-0" />
                    {t.label}
                  </button>
                )
              })}
            </nav>
            <div className="px-4 py-3" style={{ borderTop: '1px solid var(--wt-border)' }}>
              <p className="wt-mono text-[10px]" style={{ color: 'var(--wt-text-faint)' }}>BayWatch v2.3.0</p>
            </div>
          </div>

          {/* ── Right content panel ── */}
          <div className={`${mobileShowContent ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>

            <div className="flex items-center gap-2 px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--wt-border)' }}>
              <button onClick={() => setMobileShowContent(false)}
                className="md:hidden flex items-center gap-0.5 text-sm transition-colors shrink-0 mr-1 -ml-1"
                style={{ color: 'var(--wt-brand-500)' }}>
                <ChevronLeft size={16} /> Back
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold leading-tight" style={{ color: 'var(--wt-text)' }}>{activeTab.label}</h2>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--wt-text-muted)' }}>{activeTab.description}</p>
              </div>
              <button onClick={onClose}
                className="transition-colors p-1 rounded shrink-0 ml-1 text-[var(--wt-text-faint)] hover:text-[var(--wt-text-subtle)]">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">

              {/* ── General ── */}
              {tab === 'general' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--wt-text)' }}>Tilde always opens/closes console</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--wt-text-muted)' }}>
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
                      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                      style={{ background: tildeOverride ? 'var(--wt-brand-500)' : 'var(--wt-n-300)' }}
                      role="switch"
                      aria-checked={tildeOverride}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${tildeOverride ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2" style={{ borderTop: '1px solid var(--wt-border)', paddingTop: '1.25rem' }}>
                    <label className="text-sm font-medium" style={{ color: 'var(--wt-text)' }}>Theme</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'light', label: 'Light', Icon: Sun },
                        { value: 'dark',  label: 'Dark',  Icon: Moon },
                        { value: 'auto',  label: 'Auto',  Icon: Monitor },
                      ].map(({ value, label, Icon }) => (
                        <button key={value} onClick={() => setTheme(value)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                          style={theme === value
                            ? { background: 'var(--wt-brand-500)', borderColor: 'var(--wt-brand-500)', color: 'var(--wt-text-on-brand)' }
                            : { background: 'var(--wt-surface-2)', borderColor: 'var(--wt-border)', color: 'var(--wt-text-muted)' }
                          }>
                          <Icon size={14} /> {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--wt-text-faint)' }}>Auto follows your system preference.</p>
                  </div>
                </div>
              )}

              {/* ── Enclosures ── */}
              {tab === 'enclosures' && (
                <div className="flex flex-col gap-4">
                  {enclosures.map(enc => (
                    <div key={enc.id} className="rounded-xl p-4 flex flex-col gap-3"
                      style={{ background: 'var(--wt-surface-2)', border: '1px solid var(--wt-border)' }}>
                      {editingEnc?.id === enc.id ? (
                        <div className="flex items-center gap-2">
                          <input value={editingEnc.name}
                            onChange={e => setEditingEnc(f => ({ ...f, name: e.target.value }))}
                            className="wt-input flex-1" />
                          <select value={editingEnc.type}
                            onChange={e => setEditingEnc(f => ({ ...f, type: e.target.value }))}
                            className="wt-select">
                            <option value="server">Server</option>
                            <option value="jbod">JBOD</option>
                            <option value="other">Other</option>
                          </select>
                          <button onClick={() => handleSaveEnclosure(enc.id)} className="p-1"
                            style={{ color: 'var(--wt-brand-500)' }}><Save size={15} /></button>
                          <button onClick={() => setEditingEnc(null)} className="p-1"
                            style={{ color: 'var(--wt-text-faint)' }}><X size={15} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium" style={{ color: 'var(--wt-text)' }}>{enc.name}</span>
                            <span className="ml-2 text-xs capitalize" style={{ color: 'var(--wt-text-muted)' }}>{enc.type}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingEnc({ id: enc.id, name: enc.name, type: enc.type, description: enc.description || '' })}
                              className="p-1 transition-colors"
                              style={{ color: 'var(--wt-text-faint)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-brand-500)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteEnclosure(enc.id)} className="p-1"
                              style={{ color: 'var(--wt-down-400)' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-down-500)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-down-400)'}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      )}

                      {enc.arrays.map(arr => (
                        <div key={arr.id} className="pl-2" style={{ borderLeft: '1px solid var(--wt-border)' }}>
                          {editingArray?.arrayId === arr.id ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <input value={editingArray.name}
                                  onChange={e => setEditingArray(f => ({ ...f, name: e.target.value }))}
                                  className="wt-input flex-1" placeholder="Array name" />
                                <input type="number" min="1" value={editingArray.rows}
                                  onChange={e => setEditingArray(f => ({ ...f, rows: e.target.value }))}
                                  className="wt-input w-16" placeholder="Rows" />
                                <input type="number" min="1" value={editingArray.cols}
                                  onChange={e => setEditingArray(f => ({ ...f, cols: e.target.value }))}
                                  className="wt-input w-16" placeholder="Cols" />
                              </div>
                              <div className="flex items-center gap-2">
                                <select value={editingArray.group_type}
                                  onChange={e => setEditingArray(f => ({ ...f, group_type: e.target.value }))}
                                  className="wt-select flex-1">
                                  {GROUP_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                                </select>
                                <input value={editingArray.purpose}
                                  onChange={e => setEditingArray(f => ({ ...f, purpose: e.target.value }))}
                                  className="wt-input flex-1" placeholder="Purpose (optional)" />
                                <button onClick={handleSaveArray} className="p-1"
                                  style={{ color: 'var(--wt-brand-500)' }}><Save size={15} /></button>
                                <button onClick={() => setEditingArray(null)} className="p-1"
                                  style={{ color: 'var(--wt-text-faint)' }}><X size={15} /></button>
                              </div>
                              {(parseInt(editingArray.rows) < arr.rows || parseInt(editingArray.cols) < arr.cols) && (
                                <p className="text-[10px]" style={{ color: 'var(--wt-warn-600)' }}>
                                  Reducing grid size will remove out-of-bounds bays and their drive assignments.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm truncate" style={{ color: 'var(--wt-text)' }}>
                                  {arr.name}{' '}
                                  <span style={{ color: 'var(--wt-text-faint)' }}>({arr.rows}×{arr.cols})</span>
                                </span>
                                {arr.group_type && arr.group_type !== 'drive_bays' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                                    style={{ background: 'var(--wt-surface-3)', color: 'var(--wt-text-faint)' }}>
                                    {GROUP_TYPE_LABEL[arr.group_type] || arr.group_type}
                                  </span>
                                )}
                                {arr.purpose && (
                                  <span className="text-[10px] truncate hidden sm:block" style={{ color: 'var(--wt-text-faint)' }}>
                                    {arr.purpose}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setEditingArray({
                                  enclosureId: enc.id, arrayId: arr.id,
                                  name: arr.name, rows: arr.rows, cols: arr.cols,
                                  group_type: arr.group_type || 'drive_bays', purpose: arr.purpose || '',
                                })} className="p-1 transition-colors"
                                  style={{ color: 'var(--wt-text-faint)' }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-brand-500)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}>
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => handleDeleteArray(enc.id, arr.id)} className="p-1"
                                  style={{ color: 'var(--wt-down-400)' }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-down-500)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-down-400)'}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="flex flex-col gap-2 pt-1" style={{ borderTop: '1px solid var(--wt-border)' }}>
                        <div className="flex flex-wrap items-center gap-2">
                          <input placeholder="Array name" value={arrayDefaults(enc.id).name}
                            onChange={e => setArrayField(enc.id, 'name', e.target.value)}
                            className="wt-input flex-1" />
                          <input type="number" placeholder="Rows" min="1" value={arrayDefaults(enc.id).rows}
                            onChange={e => setArrayField(enc.id, 'rows', e.target.value)}
                            className="wt-input w-16" />
                          <input type="number" placeholder="Cols" min="1" value={arrayDefaults(enc.id).cols}
                            onChange={e => setArrayField(enc.id, 'cols', e.target.value)}
                            className="wt-input w-16" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={arrayDefaults(enc.id).group_type}
                            onChange={e => setArrayField(enc.id, 'group_type', e.target.value)}
                            className="wt-select flex-1">
                            {GROUP_TYPES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                          </select>
                          <input placeholder="Purpose / notes (optional)" value={arrayDefaults(enc.id).purpose}
                            onChange={e => setArrayField(enc.id, 'purpose', e.target.value)}
                            className="wt-input flex-1" />
                          <button onClick={() => handleAddArray(enc.id)}
                            className="wt-btn wt-btn--primary wt-btn--sm shrink-0">
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <form onSubmit={handleAddEnclosure} className="flex flex-wrap items-center gap-2">
                    <input placeholder="Enclosure name" value={newEnc.name}
                      onChange={e => setNewEnc(f => ({ ...f, name: e.target.value }))}
                      className="wt-input flex-1" />
                    <select value={newEnc.type} onChange={e => setNewEnc(f => ({ ...f, type: e.target.value }))}
                      className="wt-select">
                      <option value="server">Server</option>
                      <option value="jbod">JBOD</option>
                      <option value="other">Other</option>
                    </select>
                    <button type="submit" className="wt-btn wt-btn--primary">
                      <Plus size={16} /> Add
                    </button>
                  </form>
                </div>
              )}

              {/* ── Notifications ── */}
              {tab === 'notifications' && (
                <form onSubmit={handleSaveAlerts} className="flex flex-col gap-4">
                  <p className="text-sm" style={{ color: 'var(--wt-text-muted)' }}>
                    Telegram bot alerts for SMART failures, overtemp, and warranty warnings.
                  </p>
                  <Field label="Bot Token" type="password" value={alertForm.bot_token}
                    onChange={v => setAlertForm(f => ({ ...f, bot_token: v }))}
                    placeholder="Leave blank to keep existing" />
                  <Field label="Chat ID" type="text" value={alertForm.chat_id}
                    onChange={v => setAlertForm(f => ({ ...f, chat_id: v }))}
                    placeholder="Your Telegram chat ID" />
                  <div className="wt-field">
                    <label className="wt-label">Status Report Frequency</label>
                    <select value={alertForm.status_frequency}
                      onChange={e => setAlertForm(f => ({ ...f, status_frequency: e.target.value }))}
                      className="wt-select">
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
                    <label htmlFor="critical" className="text-sm" style={{ color: 'var(--wt-text)' }}>
                      Immediate critical alerts (SMART failure, overtemp, reallocated sectors)
                    </label>
                  </div>
                  <div className="pt-4 flex flex-col gap-4" style={{ borderTop: '1px solid var(--wt-border)' }}>
                    <p className="wt-eyebrow">Thresholds</p>
                    <Field label="Warranty warning (days before expiry)" type="number"
                      value={alertForm.warranty_warning_days}
                      onChange={v => setAlertForm(f => ({ ...f, warranty_warning_days: parseInt(v) || 90 }))} />
                    <Field label="Temperature warning threshold (°C) — amber" type="number"
                      value={alertForm.temp_warn_threshold_c}
                      onChange={v => setAlertForm(f => ({ ...f, temp_warn_threshold_c: parseInt(v) || 55 }))} />
                    <Field label="Temperature danger threshold (°C) — red" type="number"
                      value={alertForm.temp_alert_threshold_c}
                      onChange={v => setAlertForm(f => ({ ...f, temp_alert_threshold_c: parseInt(v) || 60 }))} />
                    <Field label="ZFS checksum errors — warn threshold" type="number"
                      value={alertForm.zfs_warn_threshold}
                      onChange={v => setAlertForm(f => ({ ...f, zfs_warn_threshold: parseInt(v) || 1 }))} />
                    <Field label="ZFS checksum errors — critical threshold" type="number"
                      value={alertForm.zfs_critical_threshold}
                      onChange={v => setAlertForm(f => ({ ...f, zfs_critical_threshold: parseInt(v) || 50 }))} />
                    <div className="wt-field">
                      <label className="wt-label">Log Level</label>
                      <div className="flex gap-2">
                        {LOG_LEVELS.map(level => (
                          <button key={level} type="button"
                            onClick={() => setAlertForm(f => ({ ...f, log_level: level }))}
                            className="px-3 py-1.5 rounded-md border text-sm font-medium transition-colors"
                            style={alertForm.log_level === level
                              ? { background: 'var(--wt-brand-500)', borderColor: 'var(--wt-brand-500)', color: 'var(--wt-text-on-brand)' }
                              : { background: 'var(--wt-surface-2)', borderColor: 'var(--wt-border)', color: 'var(--wt-text-muted)' }
                            }
                          >{level}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="submit" className="wt-btn wt-btn--primary">
                      <Save size={14} /> Save
                    </button>
                    {alertSaved && <span className="text-sm" style={{ color: 'var(--wt-up-600)' }}>Saved!</span>}
                  </div>
                </form>
              )}

              {/* ── API Keys ── */}
              {tab === 'api_keys' && (
                <div className="flex flex-col gap-5">
                  <p className="text-sm" style={{ color: 'var(--wt-text-muted)' }}>
                    Generate API keys to access drive data programmatically via the{' '}
                    <span className="wt-mono text-xs">/v1/</span> endpoints.
                    Keys are shown once on creation; copy them immediately.
                  </p>

                  <form onSubmit={handleGenerateKey} className="flex flex-wrap items-center gap-2">
                    <input placeholder="Key name (e.g. Grafana, Home Assistant)"
                      value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                      className="wt-input flex-1" />
                    <button type="submit" disabled={generatingKey || !newKeyName.trim()}
                      className="wt-btn wt-btn--primary disabled:opacity-50 shrink-0">
                      <Key size={14} /> Generate
                    </button>
                  </form>

                  {generatedKey && (
                    <div className="rounded-xl p-4 flex flex-col gap-3"
                      style={{ border: '1px solid var(--wt-warn-200)', background: 'var(--wt-warn-50)' }}>
                      <p className="text-xs font-semibold" style={{ color: 'var(--wt-warn-700)' }}>
                        Copy this key now — it won't be shown again after you leave this tab
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 wt-mono text-xs rounded-lg px-3 py-2 break-all"
                          style={{ background: 'var(--wt-surface)', border: '1px solid var(--wt-border)', color: 'var(--wt-text)' }}>
                          {generatedKey.key}
                        </code>
                        <button
                          onClick={() => { copyToClipboard(generatedKey.key); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000) }}
                          className="shrink-0 p-2 rounded-lg transition-colors"
                          style={{ background: 'var(--wt-surface)', border: '1px solid var(--wt-border)', color: 'var(--wt-text-muted)' }}
                          title="Copy to clipboard">
                          {keyCopied
                            ? <CheckCircle2 size={15} style={{ color: 'var(--wt-up-600)' }} />
                            : <Copy size={15} />}
                        </button>
                      </div>
                      <button onClick={() => setGeneratedKey(null)}
                        className="text-xs self-end transition-colors"
                        style={{ color: 'var(--wt-text-faint)' }}>
                        Dismiss
                      </button>
                    </div>
                  )}

                  {keyError && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)', color: 'var(--wt-down-600)' }}>
                      <AlertCircle size={14} className="shrink-0" /> {keyError}
                    </div>
                  )}

                  {apiKeys.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--wt-text-faint)' }}>No API keys yet</p>
                  ) : (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--wt-border)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'var(--wt-surface-2)', borderBottom: '1px solid var(--wt-border)' }}>
                            <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--wt-text-muted)' }}>Name</th>
                            <th className="text-left px-3 py-2 text-xs font-medium" style={{ color: 'var(--wt-text-muted)' }}>Key</th>
                            <th className="text-left px-3 py-2 text-xs font-medium whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>Created</th>
                            <th className="text-left px-3 py-2 text-xs font-medium whitespace-nowrap" style={{ color: 'var(--wt-text-muted)' }}>Last used</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {apiKeys.map(k => {
                            const sessionKey = sessionStorage.getItem(`apikey-${k.id}`)
                            const displayKey = sessionKey || `${k.key_prefix}…`
                            return (
                              <tr key={k.id} className="last:border-0" style={{ borderBottom: '1px solid var(--wt-border)' }}>
                                <td className="px-3 py-2.5 text-sm whitespace-nowrap" style={{ color: 'var(--wt-text)' }}>{k.name}</td>
                                <td className="px-3 py-2.5 max-w-[180px]">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <code className="wt-mono text-xs truncate flex-1" style={{ color: 'var(--wt-text-muted)' }}>{displayKey}</code>
                                    <button onClick={() => copyRowKey(k.id, displayKey)}
                                      className="shrink-0 p-1 transition-colors"
                                      style={{ color: 'var(--wt-text-faint)' }}
                                      onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-brand-500)'}
                                      onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}
                                      title={sessionKey ? 'Copy key' : 'Copy prefix'}>
                                      {copiedRowId === k.id
                                        ? <CheckCircle2 size={13} style={{ color: 'var(--wt-up-600)' }} />
                                        : <Copy size={13} />}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--wt-text-faint)' }}>{new Date(k.created_at).toLocaleDateString()}</td>
                                <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--wt-text-faint)' }}>{k.last_used_at ? relTimeAgo(k.last_used_at) : '—'}</td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center gap-0.5 justify-end">
                                    {!sessionKey && (
                                      confirmRegenerateKeyId === k.id ? (
                                        <span className="flex items-center gap-1 mr-1">
                                          <button onClick={() => handleRegenerateKey(k)} className="text-xs font-medium"
                                            style={{ color: 'var(--wt-warn-600)' }}>Regen</button>
                                          <button onClick={() => setConfirmRegenerateKeyId(null)} className="text-xs"
                                            style={{ color: 'var(--wt-text-faint)' }}>✕</button>
                                        </span>
                                      ) : (
                                        <button onClick={() => setConfirmRegenerateKeyId(k.id)}
                                          className="p-1 transition-colors"
                                          style={{ color: 'var(--wt-text-faint)' }}
                                          onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-warn-600)'}
                                          onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}
                                          title="Regenerate key">
                                          <RefreshCw size={13} />
                                        </button>
                                      )
                                    )}
                                    {confirmDeleteKeyId === k.id ? (
                                      <span className="flex items-center gap-1.5 rounded-md px-2 py-1" style={{ background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)' }}>
                                        <span className="text-xs font-medium" style={{ color: 'var(--wt-down-700)' }}>Delete?</span>
                                        <button onClick={() => handleDeleteKey(k.id)} className="text-xs font-bold"
                                          style={{ color: 'var(--wt-down-500)' }}>Yes</button>
                                        <button onClick={() => setConfirmDeleteKeyId(null)} className="text-xs"
                                          style={{ color: 'var(--wt-text-muted)' }}>No</button>
                                      </span>
                                    ) : (
                                      <button onClick={() => setConfirmDeleteKeyId(k.id)} className="p-1 transition-colors"
                                        style={{ color: 'var(--wt-text-faint)' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-down-500)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}>
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
                  <p className="text-sm" style={{ color: 'var(--wt-text-muted)' }}>
                    Add remote BayWatch instances to aggregate their drive data here. Each target needs an API key generated on the remote instance.
                  </p>

                  <form onSubmit={handleAddTarget} className="rounded-xl p-4 flex flex-col gap-3"
                    style={{ border: '1px solid var(--wt-border)', background: 'var(--wt-surface-2)' }}>
                    <p className="wt-eyebrow">Add Target</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input placeholder="Name (e.g. JBOD Shelf)" value={newTarget.name}
                        onChange={e => setNewTarget(t => ({ ...t, name: e.target.value }))}
                        className="wt-input flex-1 min-w-0" />
                      <select value={newTarget.sync_interval_minutes}
                        onChange={e => setNewTarget(t => ({ ...t, sync_interval_minutes: Number(e.target.value) }))}
                        className="wt-select shrink-0">
                        <option value={5}>5 min</option>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                    <input placeholder="URL (e.g. http://192.168.1.50:8585)" value={newTarget.url}
                      onChange={e => setNewTarget(t => ({ ...t, url: e.target.value }))}
                      className="wt-input" />
                    <input type="password" placeholder="API key (dm_…)" value={newTarget.api_key}
                      onChange={e => setNewTarget(t => ({ ...t, api_key: e.target.value }))}
                      className="wt-input" />
                    <button type="submit"
                      disabled={addingTarget || !newTarget.name.trim() || !newTarget.url.trim() || !newTarget.api_key.trim()}
                      className="wt-btn wt-btn--primary disabled:opacity-50 self-end">
                      <Plus size={14} /> Add Target
                    </button>
                  </form>

                  {fedTargets.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--wt-text-faint)' }}>No federation targets configured</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {fedTargets.map(t => (
                        <div key={t.id} className="rounded-xl p-3 flex flex-col gap-2"
                          style={{ border: '1px solid var(--wt-border)', background: 'var(--wt-surface)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: t.enabled ? 'var(--wt-up-500)' : 'var(--wt-n-400)' }} />
                            <div className="flex-1 min-w-0">
                              {renamingTargetId === t.id ? (
                                <form onSubmit={e => { e.preventDefault(); handleRenameTarget(t.id) }} className="flex items-center gap-1">
                                  <input autoFocus value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onBlur={() => handleRenameTarget(t.id)}
                                    onKeyDown={e => e.key === 'Escape' && (setRenamingTargetId(null), setRenameValue(''))}
                                    className="wt-input flex-1" />
                                </form>
                              ) : (
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--wt-text)' }}>{t.name}</p>
                              )}
                              <p className="wt-mono text-xs truncate" style={{ color: 'var(--wt-text-faint)' }}>{t.url}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { setRenamingTargetId(t.id); setRenameValue(t.name) }}
                                className="p-1 rounded transition-colors"
                                style={{ color: 'var(--wt-text-faint)' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-text-subtle)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}
                                title="Rename">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleToggleTarget(t)}
                                className="p-1 rounded transition-colors"
                                style={{ color: t.enabled ? 'var(--wt-up-600)' : 'var(--wt-text-faint)' }}
                                title={t.enabled ? 'Disable' : 'Enable'}>
                                {t.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                              </button>
                              <button onClick={() => handleSyncTarget(t.id)} disabled={syncingTargetId === t.id}
                                className="p-1 rounded transition-colors"
                                style={{ color: 'var(--wt-text-faint)' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-brand-500)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}
                                title="Sync now">
                                <RefreshCw size={14} className={syncingTargetId === t.id ? 'animate-spin' : ''} />
                              </button>
                              {confirmDeleteTargetId === t.id ? (
                                <span className="flex items-center gap-1.5">
                                  <button onClick={() => handleDeleteTarget(t.id)} className="text-xs font-medium"
                                    style={{ color: 'var(--wt-down-500)' }}>Delete</button>
                                  <button onClick={() => setConfirmDeleteTargetId(null)} className="text-xs"
                                    style={{ color: 'var(--wt-text-faint)' }}>Cancel</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmDeleteTargetId(t.id)}
                                  className="p-1 rounded transition-colors"
                                  style={{ color: 'var(--wt-text-faint)' }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--wt-down-500)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--wt-text-faint)'}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--wt-text-faint)' }}>
                            <span>Sync: every {t.sync_interval_minutes}m</span>
                            <span>Last: {relTimeAgo(t.last_synced_at)}</span>
                            {t.last_error && (
                              <span className="truncate" style={{ color: 'var(--wt-down-500)' }} title={t.last_error}>
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
                  <p className="text-sm" style={{ color: 'var(--wt-text-muted)' }}>
                    Upload a CSV with columns:{' '}
                    <span className="wt-mono text-xs" style={{ color: 'var(--wt-text)' }}>{CSV_HEADERS.join(', ')}</span>.
                    Serial is required. Position matches an existing bay label.
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={handleDownloadTemplate} className="wt-btn wt-btn--ghost">
                      <Download size={14} /> Download Template
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImport}
                      className="hidden" id="csv-upload" />
                    <label htmlFor="csv-upload"
                      className={`flex items-center gap-2 rounded-[var(--wt-r-md)] px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ background: 'var(--wt-brand-500)', color: 'var(--wt-text-on-brand)' }}>
                      <Upload size={14} />
                      {importing ? 'Importing…' : 'Choose CSV'}
                    </label>
                  </div>
                  {importResult && (
                    <div className="rounded-lg p-3 flex flex-col gap-2"
                      style={{ background: 'var(--wt-up-50)', border: '1px solid var(--wt-up-100)' }}>
                      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--wt-up-600)' }}>
                        <CheckCircle2 size={15} /> Import complete
                      </div>
                      <p className="text-xs" style={{ color: 'var(--wt-text)' }}>
                        {importResult.imported} new &nbsp;·&nbsp; {importResult.updated} updated &nbsp;·&nbsp; {importResult.assigned} assigned
                      </p>
                      {importResult.skipped.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs mb-1" style={{ color: 'var(--wt-warn-600)' }}>{importResult.skipped.length} row(s) skipped:</p>
                          <ul className="text-xs space-y-0.5 pl-2" style={{ color: 'var(--wt-text-muted)' }}>
                            {importResult.skipped.map((s, i) => (
                              <li key={i}>Row {s.row}{s.serial ? ` (${s.serial})` : ''}: {s.reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {importError && (
                    <div className="flex items-center gap-2 rounded-lg p-3 text-sm"
                      style={{ background: 'var(--wt-down-50)', border: '1px solid var(--wt-down-100)', color: 'var(--wt-down-600)' }}>
                      <AlertCircle size={15} /> {importError}
                    </div>
                  )}
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
    <div className="wt-field">
      <label className="wt-label">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="wt-input" />
    </div>
  )
}
