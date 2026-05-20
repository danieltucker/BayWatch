import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import DriveCard from '../components/DriveCard'
import { getDrive, getProfile, upsertProfile } from '../api/client'

export default function DriveDetail() {
  const { serial } = useParams()
  const navigate = useNavigate()
  const [drive, setDrive] = useState(null)
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({
    purchase_date: '', warranty_months: '', purchase_price: '', vendor: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getDrive(serial).then(setDrive).catch(() => navigate('/'))
    getProfile(serial).then(p => {
      setProfile(p)
      setForm({
        purchase_date: p.purchase_date || '',
        warranty_months: p.warranty_months ?? '',
        purchase_price: p.purchase_price ?? '',
        vendor: p.vendor || '',
        notes: p.notes || '',
      })
    }).catch(() => {})
  }, [serial, navigate])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        purchase_date: form.purchase_date || null,
        warranty_months: form.warranty_months ? parseInt(form.warranty_months) : null,
        purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
        vendor: form.vendor || null,
        notes: form.notes || null,
      }
      const updated = await upsertProfile(serial, payload)
      setProfile(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!drive) return <div className="p-8 text-gray-500">Loading…</div>

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-8 flex flex-col gap-6">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-fit"
      >
        <ArrowLeft size={16} /> Back to map
      </button>

      <DriveCard drive={drive} profile={profile} />

      <form onSubmit={handleSave} className="rounded-xl bg-gray-900 border border-gray-800 p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-white">Drive Profile</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Purchase Date" type="date" value={form.purchase_date}
            onChange={v => setForm(f => ({ ...f, purchase_date: v }))} />
          <Field label="Warranty (months)" type="number" value={form.warranty_months}
            onChange={v => setForm(f => ({ ...f, warranty_months: v }))} />
          <Field label="Purchase Price ($)" type="number" step="0.01" value={form.purchase_price}
            onChange={v => setForm(f => ({ ...f, purchase_price: v }))} />
          <Field label="Vendor" type="text" value={form.vendor}
            onChange={v => setForm(f => ({ ...f, vendor: v }))} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
          {saved && <span className="text-sm text-green-400">Saved!</span>}
        </div>
      </form>
    </div>
  )
}

function Field({ label, type, value, onChange, step }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-400">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  )
}
