import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: 'rzp_live_TUYkUUvXm46yrt', // Public key — safe to hardcode
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: NextRequest) {
  try {
    const { amount, userId } = await req.json()
    if (!amount || !userId) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

    const order = await razorpay.orders.create({
      amount: amount, // in paise
      currency: 'INR',
      notes: { type: 'wallet_topup', userId },
    })

    return NextResponse.json({ orderId: order.id, amount })
  } catch (err) {
    console.error('[wallet/topup]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
