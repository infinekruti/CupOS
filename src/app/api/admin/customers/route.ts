import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch all users from Supabase Auth
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    if (usersError) throw usersError

    // 2. Fetch all wallets
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('user_id, balance')
    
    const walletMap = new Map((wallets || []).map(w => [w.user_id, w.balance]))

    // 3. Fetch all successful transactions to calculate total spent
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('user_id, payment_amount')
      .eq('payment_status', 'paid')
      .not('user_id', 'is', null)

    const spentMap = new Map<string, number>()
    if (transactions) {
      transactions.forEach(t => {
        if (!t.user_id) return
        const current = spentMap.get(t.user_id) || 0
        spentMap.set(t.user_id, current + t.payment_amount)
      })
    }

    // 4. Map everything together
    const customers = users.map(user => {
      const phone = user.phone || user.user_metadata?.phone || null
      const email = user.email || null
      const name = user.user_metadata?.full_name || 'Guest User'
      
      return {
        id: user.id,
        name,
        email,
        phone,
        created_at: user.created_at,
        wallet_balance: walletMap.get(user.id) || 0,
        total_spent: spentMap.get(user.id) || 0,
      }
    })

    // Sort by created_at desc
    customers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ customers })
  } catch (err) {
    console.error('[admin/customers]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
