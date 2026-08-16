import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, userId } = await req.json()

    // 1. Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // 2. Fetch current wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single()

    const currentBalance = wallet ? wallet.balance : 0
    const newBalance = currentBalance + amount

    // 3. Update wallet balance
    await supabaseAdmin
      .from('wallets')
      .upsert({ user_id: userId, balance: newBalance, updated_at: new Date().toISOString() })

    // 4. Save transaction log
    await supabaseAdmin.from('wallet_transactions').insert({
      user_id: userId,
      amount: amount,
      type: 'top_up',
      reference_id: razorpay_payment_id,
    })

    return NextResponse.json({ success: true, newBalance })
  } catch (err) {
    console.error('[wallet/verify]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
