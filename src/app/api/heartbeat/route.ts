import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/heartbeat
 * Called by ESP32 every 60 seconds to report online status
 * Body: { machineId: "INDORE-001" }
 */
export async function POST(req: NextRequest) {
  try {
    const { machineId, secret } = await req.json()

    if (!machineId) {
      return NextResponse.json({ error: 'Missing machineId' }, { status: 400 })
    }

    const EXPECTED_SECRET = process.env.MACHINE_SECRET_KEY || 'CupOS_SuperSecret_123';
    if (secret !== EXPECTED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized Hardware' }, { status: 401 })
    }

    // Preserve 'maintenance' state if active on hardware fault
    const { data: currentMachine } = await supabaseAdmin
      .from('machines')
      .select('status')
      .eq('machine_code', machineId)
      .maybeSingle()

    const updatePayload: Record<string, any> = {
      last_seen: new Date().toISOString(),
    }
    // Only set 'online' if machine is not currently halted in maintenance
    if (currentMachine?.status !== 'maintenance') {
      updatePayload.status = 'online'
    }

    const { error } = await supabaseAdmin
      .from('machines')
      .update(updatePayload)
      .eq('machine_code', machineId)

    if (error) throw error

    return NextResponse.json({ ok: true, status: currentMachine?.status || 'online' })
  } catch (err) {
    console.error('[heartbeat]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
