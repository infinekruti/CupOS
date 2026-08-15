import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createTokensForOrder } from '@/lib/tokens'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/verify-payment
 * Called after Razorpay payment success
 * Verifies signature, creates tokens, saves transaction
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      productIds,
      phone,
      amount,
      userId,
    } = body

    // 1. Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // 2. Create tokens — one per product
    const { tokens, tokenIds } = await createTokensForOrder({
      orderId: razorpay_order_id,
      productIds,
      phone,
      userId: userId ?? null,
    })

    // 3. Save transaction record
    // Clean product IDs to remove _half / _full suffixes before saving to UUID array
    const cleanProductIds = productIds.map((id: string) => id.replace('_half', '').replace('_full', ''))

    await supabaseAdmin.from('transactions').insert({
      order_id:       razorpay_order_id,
      payment_id:     razorpay_payment_id,
      user_id:        userId ?? null,
      phone:          phone ?? null,
      product_ids:    cleanProductIds,
      token_ids:      tokenIds,
      payment_amount: amount,
      payment_status: 'paid',
    })

    return NextResponse.json({
      success: true,
      orderId: razorpay_order_id,
      tokens,
    })
  } catch (err) {
    console.error('[verify-payment]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
