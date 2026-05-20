import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Server } from 'lucide-react'
import {
  getEnclosures, createEnclosure, deleteEnclosure,
  createBayArray, deleteBayArray,
  getAlertConfig, updateAlertConfig,
} from '../api/client'

export default function Settings() {
  const [enclosures, setEnclosures] = useState([])
  const [alertConfig, setAlertConfig] = useState(null)
  const [newEnc, setNewEnc] = useState({ name: '', type: 'server' })
  const [newArray, setNewArray] = useState({})     // enclosureId -> {name, rows, cols}
  const [alertForm, setAlertForm] = useState({
    bot_token: '', chat_id: '', status_frequency: 'disabled',
    critical_enabled: true, warranty_warning_days: 90,
  })
  const [alertSaved, setAlertSaved] = useState(false)

  async function load() {
    const [encs, cfg] = await Promise.all([getEnclosures(), getAlertConfig()])
    setEnclosures(encs)
    setAlertConfig(cfg)
    setAlertForm(f => ({
      ...f,
      status_frequency: cfg.status_frequency,
      critical_enabled: cfg.critical_enabled,
      warranty_warning_days: cfg.warranty_warning_days,
    }))
  }

  useEffect(() => { load() }, [])

  async function handleAddEnclosure(e) {
    e.preventDefault()
    if (!newEnc.name.trim()) return
    await createEnclosure(newEnc)
    setNewEnc({ name: '', type: 'server' })
    load()
  }

  async function handleDeleteEnclosure(id) {
    if (!confirm('Delete this enclosure and all its bay arrays?')) return
    await deleteEnclosure(id)
    load()
  }

  async function handleAddArray(enclosureId) {
    const data = newArray[enclosureId] || {}
    if (!data.name || !data.rows || !data.cols) return
    await createBayArray(enclosureId, {
      name: data.name,
      rows: parseInt(data.rows),
      cols: parseInt(data.cols),
      display_order: 0,
    })
    setNewArray(m => ({ ...m, [enclosureId]: { name: '', rows: '', cols: '' } }))
    load()
  }

  async function handleDeleteArray(enclosureId, arrayId) {
    if (!confirm('Delete this bay array? Bay assignments will be lost.')) return
    await deleteBayArray(enclosureId, arrayId)
    load()
  }

  async function handleSaveAlerts(e) {
    e.preventDefault()
    await updateAlertConfig(alertForm)
    setAlertSaved(true)
    setTimeout(() => setAlertSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8 flex flex-col gap-8">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      {/* ── Enclosures ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
          <Server size={16} /> Enclosures
        </h2>

        {enclosures.map(enc => (
          <div key={enc.id} className="rounded-xl bg-gray-900 border border-gray-800 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-white">{enc.name}</span>
                <span className="ml-2 text-xs text-gray-500 capitalize">{enc.type}</span>
              </div>
              <button onClick={() => handleDeleteEnclosure(enc.id)}
                className="text-red-400 hover:text-red-300 p-1">
                <Trash2 size={16} />
              </button>
            </div>

            {enc.arrays.map(arr => (
              <div key={arr.id} className="flex items-center justify-between pl-2 border-l border-gray-700">
                <span className="text-sm text-gray-300">
                  {arr.name} <span className="text-gray-500">({arr.rows}×{arr.cols})</span>
                </span>
                <button onClick={() => handleDeleteArray(enc.id, arr.id)}
                  className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {/* Add bay array */}
            <div className="flex items-center gap-2 pt-1">
              <input placeholder="Array name" value={newArray[enc.id]?.name || ''}
                onChange={e => setNewArray(m => ({ ...m, [enc.id]: { ...m[enc.id], name: e.target.value } }))}
                className="flex-1 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="number" placeholder="Rows" min="1" value={newArray[enc.id]?.rows || ''}
                onChange={e => setNewArray(m => ({ ...m, [enc.id]: { ...m[enc.id], rows: e.target.value } }))}
                className="w-16 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="number" placeholder="Cols" min="1" value={newArray[enc.id]?.cols || ''}
                onChange={e => setNewArray(m => ({ ...m, [enc.id]: { ...m[enc.id], cols: e.target.value } }))}
                className="w-16 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => handleAddArray(enc.id)}
                className="flex items-center gap-1 rounded bg-blue-700 hover:bg-blue-600 px-3 py-1 text-sm text-white">
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        ))}

        <form onSubmit={handleAddEnclosure} className="flex items-center gap-2">
          <input placeholder="Enclosure name" value={newEnc.name}
            onChange={e => setNewEnc(f => ({ ...f, name: e.target.value }))}
            className="flex-1 rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <select value={newEnc.type}
            onChange={e => setNewEnc(f => ({ ...f, type: e.target.value }))}
            className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none">
            <option value="server">Server</option>
            <option value="jbod">JBOD</option>
            <option value="other">Other</option>
          </select>
          <button type="submit"
            className="flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white">
            <Plus size={16} /> Add Enclosure
          </button>
        </form>
      </section>

      {/* ── Notifications ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-gray-200">Notifications (Telegram)</h2>
        <form onSubmit={handleSaveAlerts} className="rounded-xl bg-gray-900 border border-gray-800 p-4 flex flex-col gap-4">
          <Field label="Bot Token" type="password" value={alertForm.bot_token}
            onChange={v => setAlertForm(f => ({ ...f, bot_token: v }))}
            placeholder="Leave blank to keep existing" />
          <Field label="Chat ID" type="text" value={alertForm.chat_id}
            onChange={v => setAlertForm(f => ({ ...f, chat_id: v }))}
            placeholder="Your Telegram chat ID" />

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Status Report Frequency</label>
            <select value={alertForm.status_frequency}
              onChange={e => setAlertForm(f => ({ ...f, status_frequency: e.target.value }))}
              className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none">
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
            <label htmlFor="critical" className="text-sm text-gray-300">
              Immediate critical alerts (SMART failure, overtemp, reallocated sectors)
            </label>
          </div>

          <Field label="Warranty warning (days before expiry)" type="number"
            value={alertForm.warranty_warning_days}
            onChange={v => setAlertForm(f => ({ ...f, warranty_warning_days: parseInt(v) || 90 }))} />

          <div className="flex items-center gap-3">
            <button type="submit"
              className="flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-medium text-white">
              <Save size={14} /> Save
            </button>
            {alertSaved && <span className="text-sm text-green-400">Saved!</span>}
          </div>
        </form>
      </section>
    </div>
  )
}

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>
  )
}
