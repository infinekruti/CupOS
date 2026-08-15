import { NextRequest, NextResponse } from 'next/server'
import { getOrderTokens } from '@/lib/tokens'

/**
 * GET /api/order/[orderId]
 * Returns all tokens and products for an order (for QR page)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const tokens = await getOrderTokens(orderId)
    return NextResponse.json({ tokens })
  } catch (err) {
    console.error('[order]', err)
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
}
