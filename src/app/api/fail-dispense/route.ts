import { NextRequest, NextResponse } from 'next/server'
import { rollbackToken } from '@/lib/tokens'

/**
 * POST /api/fail-dispense
 * Called by ESP32 when hardware fails after token validation (e.g., cup jam, door error)
 * Body: { machineId: "INDORE-001", secret: "...", token: "CPOS-XXXXXXXX", reason: "cup_dispense_failed" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { machineId, token, secret, reason } = body

    if (!machineId || !token) {
      return NextResponse.json(
        { success: false, reason: 'Missing machineId or token' },
        { status: 400 }
      )
    }

    const EXPECTED_SECRET = process.env.MACHINE_SECRET_KEY || 'CupOS_SuperSecret_123'
    if (secret !== EXPECTED_SECRET) {
      return NextResponse.json(
        { success: false, reason: 'Unauthorized Hardware' },
        { status: 401 }
      )
    }

    const result = await rollbackToken({
      token,
      machineCode: machineId,
      reason,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    console.error('[fail-dispense]', err)
    return NextResponse.json(
      { success: false, reason: 'Server error' },
      { status: 500 }
    )
  }
}
