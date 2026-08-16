import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createTokensForOrder } from '@/lib/tokens'

export async function POST(req: NextRequest) {
  try {
    const { productIds, phone, amount, userId } = await req.json()

    if (!userId || !amount || !productIds) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // 1. Fetch wallet balance securely
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single()

    if (!wallet || wallet.balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // 2. Generate a unique order ID for wallet purchases
    const orderId = `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    // 3. Create tokens
    const { tokens, tokenIds } = await createTokensForOrder({
      orderId,
      productIds,
      phone: phone || null,
      userId,
    })

    // 4. Clean product IDs for the UUID array
    const cleanProductIds = productIds.map((id: string) => id.replace('_half', '').replace('_full', ''))

    // 5. Update wallet balance
    const newBalance = wallet.balance - amount
    await supabaseAdmin.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId)

    // 6. Save transaction records
    await Promise.all([
      supabaseAdmin.from('transactions').insert({
        order_id:       orderId,
        payment_id:     'wallet',
        user_id:        userId,
        phone:          phone || null,
        product_ids:    cleanProductIds,
        token_ids:      tokenIds,
        payment_amount: amount,
        payment_status: 'paid',
      }),
      supabaseAdmin.from('wallet_transactions').insert({
        user_id: userId,
        amount: -amount,
        type: 'spend',
        reference_id: orderId,
      })
    ])

    return NextResponse.json({ success: true, orderId, tokens })

  } catch (err) {
    console.error('[wallet/pay]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
