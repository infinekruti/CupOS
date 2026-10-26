import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export interface MachineAlertItem {
  id: string
  machineId: string
  errorCode: string
  details?: string
  timestamp: string
  resolved: boolean
}

// In-memory buffer of recent machine alerts
const alertHistory: MachineAlertItem[] = []

/**
 * POST /api/machine-alert
 * Called by ESP32 firmware when machine transitions to CupOSState::Error
 * Body: { machineId: "INDORE-001", secret: "...", status: "maintenance", errorCode: "CUP_JAM", details: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { machineId, secret, status = 'maintenance', errorCode = 'HARDWARE_ERROR', details = '' } = body

    if (!machineId) {
      return NextResponse.json({ success: false, reason: 'Missing machineId' }, { status: 400 })
    }

    const EXPECTED_SECRET = process.env.MACHINE_SECRET_KEY || 'CupOS_SuperSecret_123'
    if (secret !== EXPECTED_SECRET) {
      return NextResponse.json({ success: false, reason: 'Unauthorized Hardware' }, { status: 401 })
    }

    const timestamp = new Date().toISOString()
    console.warn(`[MACHINE ALERT] Machine ${machineId} reported ERROR: ${errorCode} - ${details}`)

    // 1. Update machine status to maintenance in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('machines')
      .update({
        status: status,
        last_seen: timestamp,
      })
      .eq('machine_code', machineId)

    if (updateError) {
      console.error('[machine-alert] Supabase update failed:', updateError)
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
    }

    // 2. Append to in-memory alerts ring buffer
    const alertEntry: MachineAlertItem = {
      id: `${machineId}-${Date.now()}`,
      machineId,
      errorCode,
      details,
      timestamp,
      resolved: false,
    }
    alertHistory.unshift(alertEntry)
    if (alertHistory.length > 50) alertHistory.pop()

    return NextResponse.json({
      success: true,
      message: `Machine ${machineId} set to ${status}. Alert logged.`,
      errorCode,
      timestamp,
    })
  } catch (err: any) {
    console.error('[machine-alert] Server exception:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

/**
 * GET /api/machine-alert
 * Fetches recent alerts for the Admin dashboard
 */
export async function GET() {
  return NextResponse.json({
    alerts: alertHistory,
  })
}

/**
 * PATCH /api/machine-alert
 * Admin can resolve an alert or return machine to online
 */
export async function PATCH(req: NextRequest) {
  try {
    const { machineId, machineDbId, resolveAll = false } = await req.json()

    if (machineDbId) {
      await supabaseAdmin
        .from('machines')
        .update({ status: 'online' })
        .eq('id', machineDbId)
    } else if (machineId) {
      await supabaseAdmin
        .from('machines')
        .update({ status: 'online' })
        .eq('machine_code', machineId)
    }

    // Mark corresponding in-memory alerts resolved
    for (const a of alertHistory) {
      if (resolveAll || a.machineId === machineId) {
        a.resolved = true
      }
    }

    return NextResponse.json({ success: true, message: 'Alerts resolved and machine set to online' })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
