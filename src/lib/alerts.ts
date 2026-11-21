import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from './supabase'
import { ErrorMetadata, ERROR_METADATA, getErrorMetadata } from './error-codes'

export type { ErrorMetadata }
export { ERROR_METADATA, getErrorMetadata }

export interface MachineAlertItem {
  id: string
  machineId: string
  errorCode: string
  details?: string
  timestamp: string
  resolved: boolean
  resolvedAt?: string
}

// Local file persistence path (survives Next.js server restarts)
const DATA_DIR = path.join(process.cwd(), '.data')
const ALERTS_FILE = path.join(DATA_DIR, 'machine_alerts.json')

let memoryAlerts: MachineAlertItem[] = []
let isInitialized = false

function loadAlertsFromFile(): MachineAlertItem[] {
  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = fs.readFileSync(ALERTS_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (err) {
    console.error('[alerts] Error reading alerts from disk:', err)
  }
  return []
}

function saveAlertsToFile(alerts: MachineAlertItem[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts.slice(0, 100), null, 2), 'utf-8')
  } catch (err) {
    console.error('[alerts] Error saving alerts to disk:', err)
  }
}

function initAlerts() {
  if (!isInitialized) {
    memoryAlerts = loadAlertsFromFile()
    isInitialized = true
  }
}

/**
 * Get all alerts (in-memory + disk + optional Supabase fallback)
 */
export async function getAlerts(): Promise<MachineAlertItem[]> {
  initAlerts()

  // Try fetching from Supabase machine_alerts table if it exists
  try {
    const { data, error } = await supabaseAdmin
      .from('machine_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data && data.length > 0) {
      // Merge with memory alerts
      const dbAlerts: MachineAlertItem[] = data.map((row: any) => ({
        id: row.id,
        machineId: row.machine_code,
        errorCode: row.error_code,
        details: row.details,
        timestamp: row.created_at,
        resolved: row.resolved ?? false,
        resolvedAt: row.resolved_at,
      }))

      // Combine unique IDs
      const seen = new Set<string>()
      const combined: MachineAlertItem[] = []
      for (const a of [...memoryAlerts, ...dbAlerts]) {
        if (!seen.has(a.id)) {
          seen.add(a.id)
          combined.push(a)
        }
      }
      memoryAlerts = combined
    }
  } catch {
    // If table doesn't exist, ignore and use memory/file store
  }

  return memoryAlerts
}

/**
 * Record a new alert or online resolution
 */
export async function recordAlert({
  machineId,
  errorCode,
  details = '',
  status = 'maintenance',
}: {
  machineId: string
  errorCode: string
  details?: string
  status?: string
}): Promise<MachineAlertItem | null> {
  initAlerts()
  const timestamp = new Date().toISOString()

  if (status === 'online') {
    // Mark all existing alerts for this machine as resolved
    for (const a of memoryAlerts) {
      if (a.machineId === machineId && !a.resolved) {
        a.resolved = true
        a.resolvedAt = timestamp
      }
    }
    saveAlertsToFile(memoryAlerts)

    try {
      await supabaseAdmin
        .from('machine_alerts')
        .update({ resolved: true, resolved_at: timestamp })
        .eq('machine_code', machineId)
        .eq('resolved', false)
    } catch {}

    return null
  }

  // If machine already has an active unresolved specific error (like CUP_JAM),
  // and the new code is generic (MACHINE_IN_ERROR_STATE), do NOT overwrite root cause!
  const existingActive = memoryAlerts.find(
    a => a.machineId === machineId && !a.resolved
  )

  let finalErrorCode = errorCode
  let finalDetails = details

  if (existingActive) {
    const isNewGeneric = errorCode === 'MACHINE_IN_ERROR_STATE' || errorCode === 'HARDWARE_ERROR'
    const isOldSpecific = existingActive.errorCode !== 'MACHINE_IN_ERROR_STATE' && existingActive.errorCode !== 'HARDWARE_ERROR'

    if (isNewGeneric && isOldSpecific) {
      // Keep original root cause code!
      finalErrorCode = existingActive.errorCode
      finalDetails = existingActive.details ? `${existingActive.details} (Awaiting service)` : details
      existingActive.timestamp = timestamp // update recency
      saveAlertsToFile(memoryAlerts)
      return existingActive
    }
  }

  const alertEntry: MachineAlertItem = {
    id: `${machineId}-${Date.now()}`,
    machineId,
    errorCode: finalErrorCode,
    details: finalDetails,
    timestamp,
    resolved: false,
  }

  // Prepend new alert
  memoryAlerts.unshift(alertEntry)
  if (memoryAlerts.length > 100) memoryAlerts.pop()
  saveAlertsToFile(memoryAlerts)

  // Also persist to Supabase machine_alerts table if present
  try {
    await supabaseAdmin.from('machine_alerts').insert({
      id: alertEntry.id,
      machine_code: machineId,
      error_code: finalErrorCode,
      details: finalDetails,
      resolved: false,
      created_at: timestamp,
    })
  } catch {}

  return alertEntry
}

/**
 * Mark alerts resolved and reset machine to online
 */
export async function resolveAlerts(machineId: string, machineDbId?: string): Promise<boolean> {
  initAlerts()
  const timestamp = new Date().toISOString()

  // 1. Update Supabase machines table to 'online'
  if (machineDbId) {
    await supabaseAdmin
      .from('machines')
      .update({ status: 'online', last_seen: timestamp })
      .eq('id', machineDbId)
  } else if (machineId) {
    await supabaseAdmin
      .from('machines')
      .update({ status: 'online', last_seen: timestamp })
      .eq('machine_code', machineId)
  }

  // 2. Mark memory & disk alerts resolved
  for (const a of memoryAlerts) {
    if (!machineId || a.machineId === machineId) {
      a.resolved = true
      a.resolvedAt = timestamp
    }
  }
  saveAlertsToFile(memoryAlerts)

  // 3. Mark Supabase machine_alerts resolved if present
  try {
    const q = supabaseAdmin
      .from('machine_alerts')
      .update({ resolved: true, resolved_at: timestamp })
      .eq('resolved', false)
    if (machineId) {
      await q.eq('machine_code', machineId)
    } else {
      await q
    }
  } catch {}

  return true
}
