import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordAlert, getAlerts, resolveAlerts, MachineAlertItem } from '@/lib/alerts'

export type { MachineAlertItem }

/**
 * POST /api/machine-alert
 * Called by ESP32 firmware when machine transitions to CupOSState::Error or CupOSState::SelfTest pass
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
    if (status === 'online') {
      console.log(`[MACHINE ONLINE] Machine ${machineId} reported HEALTHY ONLINE status: ${details || 'Self-test passed'}`)
    } else {
      console.warn(`[MACHINE ALERT] Machine ${machineId} reported ERROR: ${errorCode} - ${details}`)
    }

    // 1. Update machine status in Supabase (online or maintenance)
    const { error: updateError } = await supabaseAdmin
      .from('machines')
      .update({
        status: status,
        last_seen: timestamp,
      })
      .eq('machine_code', machineId)

    if (updateError) {
      console.error('[machine-alert] Supabase update failed:', updateError)
    }

    // 2. Persist alert to storage (Memory + Disk + Supabase machine_alerts)
    const alertEntry = await recordAlert({
      machineId,
      errorCode,
      details,
      status,
    })

    return NextResponse.json({
      success: true,
      message: `Machine ${machineId} set to ${status}. Alert logged.`,
      errorCode: alertEntry?.errorCode || errorCode,
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
  try {
    const alerts = await getAlerts()
    return NextResponse.json({ alerts })
  } catch (err: any) {
    console.error('[machine-alert] GET exception:', err)
    return NextResponse.json({ alerts: [] })
  }
}

/**
 * PATCH /api/machine-alert
 * Admin resolves an alert or returns machine to online
 */
export async function PATCH(req: NextRequest) {
  try {
    const { machineId, machineDbId, resolveAll = false } = await req.json()

    await resolveAlerts(machineId, machineDbId)

    return NextResponse.json({
      success: true,
      message: 'Alerts resolved and machine set to online',
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
