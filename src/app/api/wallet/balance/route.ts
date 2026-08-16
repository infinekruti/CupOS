import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ balance: 0 })

    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single()

    if (!wallet) {
      // Auto-create wallet if it doesn't exist
      await supabaseAdmin.from('wallets').insert({ user_id: userId, balance: 0 })
      return NextResponse.json({ balance: 0 })
    }

    return NextResponse.json({ balance: wallet.balance })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
