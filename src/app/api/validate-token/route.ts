import { NextRequest, NextResponse } from 'next/server'
import { validateAndRedeemToken } from '@/lib/tokens'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/validate-token
 * Called by ESP32 to validate and redeem a token
 * Body: { machineId: "INDORE-001", token: "CPOS-8F4A2D91" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { machineId, token, secret } = body

    if (!machineId || !token) {
      return NextResponse.json(
        { success: false, reason: 'Missing machineId or token' },
        { status: 400 }
      )
    }

    const EXPECTED_SECRET = process.env.MACHINE_SECRET_KEY || 'CupOS_SuperSecret_123';
    if (secret !== EXPECTED_SECRET) {
      return NextResponse.json(
        { success: false, reason: 'Unauthorized Hardware' },
        { status: 401 }
      )
    }

    const result = await validateAndRedeemToken({ token, machineCode: machineId })

    // Update machine last_seen on every validation attempt, preserving 'maintenance' status
    const { data: currentMachine } = await supabaseAdmin
      .from('machines')
      .select('status')
      .eq('machine_code', machineId)
      .maybeSingle()

    const updatePayload: Record<string, any> = {
      last_seen: new Date().toISOString(),
    }
    if (currentMachine?.status !== 'maintenance') {
      updatePayload.status = 'online'
    }

    await supabaseAdmin
      .from('machines')
      .update(updatePayload)
      .eq('machine_code', machineId)

    return NextResponse.json(result, { status: result.success ? 200 : 200 })
  } catch (err) {
    console.error('[validate-token]', err)
    return NextResponse.json(
      { success: false, reason: 'Server error' },
      { status: 500 }
    )
  }
}
