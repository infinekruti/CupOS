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
    const { machineId, token } = body

    if (!machineId || !token) {
      return NextResponse.json(
        { success: false, reason: 'Missing machineId or token' },
        { status: 400 }
      )
    }

    const result = await validateAndRedeemToken({ token, machineCode: machineId })

    // Update machine last_seen on every validation attempt
    await supabaseAdmin
      .from('machines')
      .update({ last_seen: new Date().toISOString(), status: 'online' })
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
