import { NextRequest, NextResponse } from 'next/server'
import { createTokensForOrder } from '@/lib/tokens'

/**
 * POST /api/test-token
 * DEV ONLY — creates a real token without payment for ESP testing
 * Body: { productId: string }
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const { productId } = await req.json()
    if (!productId) {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
    }

    const fakeOrderId = `TEST-${Date.now()}`
    const { tokens, tokenIds } = await createTokensForOrder({
      orderId: fakeOrderId,
      productIds: [productId],
      phone: undefined,
    })

    return NextResponse.json({
      success: true,
      orderId: fakeOrderId,
      token: tokens[0],
      tokenId: tokenIds[0],
    })
  } catch (err) {
    console.error('[test-token]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
