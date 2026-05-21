import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Enclosures ────────────────────────────────────────────────────────────────
export const getEnclosures = () => api.get('/enclosures').then(r => r.data)
export const createEnclosure = (data) => api.post('/enclosures', data).then(r => r.data)
export const updateEnclosure = (id, data) => api.put(`/enclosures/${id}`, data).then(r => r.data)
export const deleteEnclosure = (id) => api.delete(`/enclosures/${id}`)
export const createBayArray = (enclosureId, data) =>
  api.post(`/enclosures/${enclosureId}/arrays`, data).then(r => r.data)
export const deleteBayArray = (enclosureId, arrayId) =>
  api.delete(`/enclosures/${enclosureId}/arrays/${arrayId}`)

// ── Bays ──────────────────────────────────────────────────────────────────────
export const getBays = (arrayId) => api.get(`/bays/array/${arrayId}`).then(r => r.data)
export const assignDrive = (bayId, driveSerial) =>
  api.put(`/bays/${bayId}/assign`, { drive_serial: driveSerial }).then(r => r.data)
export const unassignDrive = (bayId) =>
  api.put(`/bays/${bayId}/assign`, { drive_serial: null }).then(r => r.data)
export const setBayLabel = (bayId, label) =>
  api.put(`/bays/${bayId}/label`, null, { params: { label } }).then(r => r.data)

// ── Drives ────────────────────────────────────────────────────────────────────
export const getDrives = () => api.get('/drives').then(r => r.data)
export const getDrive = (serial) => api.get(`/drives/${serial}`).then(r => r.data)
export const createDrive = (data) => api.post('/drives', data).then(r => r.data)
export const patchDrive = (serial, data) => api.patch(`/drives/${serial}`, data).then(r => r.data)
export const triggerScan = () => api.post('/drives/scan').then(r => r.data)
export const triggerScanSync = () => api.post('/drives/scan/sync').then(r => r.data)
export const importCSV = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/drives/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
export const getLogs = (after = 0) =>
  api.get('/drives/logs', { params: { after } }).then(r => r.data)

// ── Profiles ──────────────────────────────────────────────────────────────────
export const getProfile = (serial) => api.get(`/profiles/${serial}`).then(r => r.data)
export const upsertProfile = (serial, data) =>
  api.put(`/profiles/${serial}`, data).then(r => r.data)
export const deleteProfile = (serial) => api.delete(`/profiles/${serial}`)

// ── Alerts ────────────────────────────────────────────────────────────────────
export const getAlerts = (limit = 100) =>
  api.get('/alerts', { params: { limit } }).then(r => r.data)
export const getAlertConfig = () => api.get('/alerts/config').then(r => r.data)
export const updateAlertConfig = (data) => api.put('/alerts/config', data).then(r => r.data)

export default api
