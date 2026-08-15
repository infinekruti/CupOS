import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/heartbeat
 * Called by ESP32 every 60 seconds to report online status
 * Body: { machineId: "INDORE-001" }
 */
export async function POST(req: NextRequest) {
  try {
    const { machineId } = await req.json()

    if (!machineId) {
      return NextResponse.json({ error: 'Missing machineId' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('machines')
      .update({
        last_seen: new Date().toISOString(),
        status: 'online',
      })
      .eq('machine_code', machineId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[heartbeat]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
