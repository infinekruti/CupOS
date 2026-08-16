import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = await req.json() // amount in paise

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // 1. Fetch current wallet
    let { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single()

    // 2. Auto-initialize wallet if it doesn't exist
    if (!wallet) {
      const { data: newWallet, error: initErr } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: userId, balance: 0 })
        .select('balance')
        .single()
      
      if (initErr) throw initErr
      wallet = newWallet
    }

    // 3. Update balance
    const newBalance = wallet.balance + amount
    await supabaseAdmin
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    // 4. Log the transaction as admin_credit
    await supabaseAdmin.from('wallet_transactions').insert({
      user_id: userId,
      amount: amount,
      type: 'admin_credit',
      reference_id: `admin_credit_${Date.now()}`,
    })

    return NextResponse.json({ success: true, newBalance })
  } catch (err) {
    console.error('[admin/wallet-credit]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
