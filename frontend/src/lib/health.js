// Drive health scoring — shared by DriveCard, the Bays drive panel and DriveDetail.

export function healthState(drive) {
  if (drive.smart_status === 'FAILED') return 'failed'
  if ((drive.zfs_checksum_errors ?? 0) >= 50 || (drive.zfs_write_errors ?? 0) > 0) return 'failed'
  if (drive.smart_status === 'PASSED') {
    const hasErrors = (drive.reallocated_sectors ?? 0) > 0
      || (drive.pending_sectors ?? 0) > 0
      || (drive.uncorrectable_errors ?? 0) > 0
      || (drive.zfs_checksum_errors ?? 0) > 0
    return hasErrors ? 'warn' : 'ok'
  }
  return 'unknown'
}

// Expected lifetime I/O in bytes by drive type
export const IO_CURVES = {
  consumer_hdd:    { read: 150e12,  write: 75e12   },
  nas_hdd:         { read: 500e12,  write: 200e12  },
  enterprise_hdd:  { read: 2000e12, write: 1000e12 },
  consumer_ssd:    { read: 150e12,  write: 60e12   },
  enterprise_ssd:  { read: 1000e12, write: 500e12  },
  nvme_consumer:   { read: 200e12,  write: 80e12   },
  nvme_enterprise: { read: 1000e12, write: 500e12  },
  optane:          { read: 5000e12, write: 5000e12 },
}

// Drive-type-aware age curves { warn, max } in power-on hours
export const AGE_CURVES = {
  consumer_hdd:    { warn: 30000, max: 50000, label: 'Consumer HDD' },
  nas_hdd:         { warn: 40000, max: 60000, label: 'NAS HDD' },
  enterprise_hdd:  { warn: 55000, max: 80000, label: 'Enterprise HDD' },
  consumer_ssd:    { warn: 30000, max: 50000, label: 'Consumer SSD' },
  enterprise_ssd:  { warn: 50000, max: 70000, label: 'Enterprise SSD' },
  nvme_consumer:   { warn: 30000, max: 50000, label: 'NVMe consumer' },
  nvme_enterprise: { warn: 50000, max: 70000, label: 'NVMe enterprise' },
  optane:          { warn: 70000, max: 100000, label: 'Optane' },
}

export function inferDriveType(drive) {
  if (drive.rpm === 0) {
    if (drive.form_factor === 'M.2' || drive.form_factor === 'U.2') return 'nvme_consumer'
    return 'consumer_ssd'
  }
  if (drive.rpm != null && drive.rpm > 0) {
    if (/exos|ultrastar|gold|datacenter|enterprise|mc\d|mg\d|dc\s/i.test(drive.model || '') ||
        (drive.rpm >= 7200 && (drive.capacity_bytes || 0) >= 8e12)) return 'enterprise_hdd'
    if (/red|ironwolf|nas|surveillance/i.test(drive.model || '')) return 'nas_hdd'
    return 'consumer_hdd'
  }
  return 'consumer_hdd'
}

// Composite health score 0–100 with per-factor breakdown
// Returns { score: number|null, breakdown: Array<{factor, detail, delta, positive?}> }
export function computeHealthScore(drive, history = [], ratedTbw = null, warnC = 55, dangerC = 65) {
  if (!drive.smart_status || drive.smart_status === 'UNKNOWN') return { score: null, breakdown: [] }
  if (drive.smart_status === 'FAILED') return { score: 0, breakdown: [{ factor: 'SMART failure', detail: 'FAILED status', delta: -100 }] }

  let score = 100
  const breakdown = []

  breakdown.push({ factor: 'SMART status', detail: 'PASSED', delta: 0, positive: true })

  const realloc = drive.reallocated_sectors ?? 0
  if (realloc > 0) {
    const d = -Math.min(40, realloc * 4)
    score += d; breakdown.push({ factor: 'Reallocated sectors', detail: String(realloc), delta: d })
  }
  const pending = drive.pending_sectors ?? 0
  if (pending > 0) {
    const d = -Math.min(25, pending * 5)
    score += d; breakdown.push({ factor: 'Pending sectors', detail: String(pending), delta: d })
  }
  const uncorr = drive.uncorrectable_errors ?? 0
  if (uncorr > 0) {
    const d = -Math.min(35, uncorr * 10)
    score += d; breakdown.push({ factor: 'Uncorrectable errors', detail: String(uncorr), delta: d })
  }

  const cksum = drive.zfs_checksum_errors ?? 0
  if (cksum > 0) {
    const d = cksum >= 50 ? -40 : cksum >= 10 ? -20 : -10
    score += d; breakdown.push({ factor: 'ZFS checksum errors', detail: String(cksum), delta: d })
  }
  if ((drive.zfs_write_errors ?? 0) > 0) {
    const d = -30
    score += d; breakdown.push({ factor: 'ZFS write errors', detail: String(drive.zfs_write_errors), delta: d })
  }

  // Drive-type-aware age penalty — two-phase curve
  // Phase 1: 50% of warn → warn: 0 to -10 (light)
  // Phase 2: warn → max: -10 to -40 (steep)
  const poh = drive.power_on_hours ?? 0
  const driveType = drive.drive_type || inferDriveType(drive)
  const ac = AGE_CURVES[driveType] || AGE_CURVES.consumer_hdd
  const earlyWarn = ac.warn * 0.5
  if (poh >= earlyWarn) {
    let d
    if (poh < ac.warn) {
      d = -Math.round(((poh - earlyWarn) / Math.max(1, ac.warn - earlyWarn)) * 10)
    } else {
      const phase2 = -Math.round(((poh - ac.warn) / Math.max(1, ac.max - ac.warn)) * 30)
      d = Math.max(-40, -10 + phase2)
    }
    if (d < 0) {
      score += d
      breakdown.push({ factor: 'Drive age', detail: `${poh.toLocaleString()} hrs (${ac.label})`, delta: d })
    } else {
      breakdown.push({ factor: 'Drive age', detail: `${poh.toLocaleString()} hrs — within range`, delta: 0, positive: true })
    }
  } else {
    breakdown.push({ factor: 'Drive age', detail: `${poh.toLocaleString()} hrs — within range`, delta: 0, positive: true })
  }

  // Heat exposure across all available history (not just current temp)
  const tempReadings = history.filter(h => h.temperature_c != null)
  if (tempReadings.length >= 3) {
    const aboveDanger = tempReadings.filter(h => h.temperature_c >= dangerC).length
    const aboveWarn   = tempReadings.filter(h => h.temperature_c >= warnC && h.temperature_c < dangerC).length
    const pctDanger = aboveDanger / tempReadings.length
    const pctWarn   = aboveWarn   / tempReadings.length
    const d = Math.round(-(pctDanger * 20 + pctWarn * 10))
    if (d < 0) {
      score += d
      breakdown.push({ factor: 'Heat exposure', detail: `${Math.round((pctDanger + pctWarn) * 100)}% of ${tempReadings.length} readings ≥${warnC}°C`, delta: d })
    } else {
      breakdown.push({ factor: 'Heat exposure', detail: `${tempReadings.length} readings all within range`, delta: 0, positive: true })
    }
  } else if (drive.temperature_c != null) {
    const temp = drive.temperature_c
    const d = temp >= dangerC ? -10 : temp >= warnC ? -5 : 0
    if (d < 0) { score += d; breakdown.push({ factor: 'Temperature (current)', detail: `${temp}°C`, delta: d }) }
  }

  // TBW endurance (SSD types only, requires rated_tbw from profile)
  const isSsd = ['consumer_ssd', 'enterprise_ssd', 'nvme_consumer', 'nvme_enterprise', 'optane'].includes(driveType)
  if (isSsd && ratedTbw) {
    const latest = [...history].reverse().find(h => h.write_bytes != null)
    if (latest) {
      const writtenTb = latest.write_bytes / 1e12
      const pctUsed = writtenTb / ratedTbw
      if (pctUsed > 0.5) {
        const d = Math.max(-20, -Math.round((pctUsed - 0.5) * 40))
        score += d
        breakdown.push({ factor: 'TBW endurance', detail: `${writtenTb.toFixed(1)} TB written / ${ratedTbw} TB rated (${Math.round(pctUsed * 100)}%)`, delta: d })
      } else {
        breakdown.push({ factor: 'TBW endurance', detail: `${writtenTb.toFixed(1)} TB written / ${ratedTbw} TB rated`, delta: 0, positive: true })
      }
    }
  }

  return { score: Math.max(0, Math.round(score)), breakdown }
}
export function scoreLabel(score) {
  if (score == null) return { label: 'Unknown',  color: 'var(--wt-text-faint)' }
  if (score >= 90)   return { label: 'Excellent', color: 'var(--wt-up-600)' }
  if (score >= 75)   return { label: 'Good',      color: 'var(--wt-up-500)' }
  if (score >= 60)   return { label: 'Fair',      color: 'var(--wt-warn-600)' }
  if (score >= 40)   return { label: 'Poor',      color: 'var(--wt-warn-500)' }
  return               { label: 'Critical',   color: 'var(--wt-down-500)' }
}
