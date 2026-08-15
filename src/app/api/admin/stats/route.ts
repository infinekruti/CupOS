import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    const monthISO = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    const [
      { data: machines },
      { data: todayTx },
      { data: monthTx },
      { data: coffeeToday },
    ] = await Promise.all([
      supabaseAdmin.from('machines').select('id, status'),
      supabaseAdmin.from('transactions').select('payment_amount, user_id, phone').gte('created_at', todayISO),
      supabaseAdmin.from('transactions').select('payment_amount, user_id, phone').gte('created_at', monthISO),
      supabaseAdmin.from('tokens').select('id').eq('status', 'REDEEMED').gte('redeemed_at', todayISO),
    ])

    const onlineMachines = machines?.filter(m => m.status === 'online').length ?? 0
    const uniqueMonthCustomers = new Set([
      ...(monthTx?.map(t => t.user_id).filter(Boolean) ?? []),
      ...(monthTx?.map(t => t.phone).filter(Boolean) ?? []),
    ])

    return NextResponse.json({
      totalMachines:    machines?.length ?? 0,
      onlineMachines,
      offlineMachines:  (machines?.length ?? 0) - onlineMachines,
      revenueToday:     todayTx?.reduce((s, t) => s + t.payment_amount, 0) ?? 0,
      ordersToday:      todayTx?.length ?? 0,
      revenueMonth:     monthTx?.reduce((s, t) => s + t.payment_amount, 0) ?? 0,
      coffeeToday:      coffeeToday?.length ?? 0,
      activeCustomers:  uniqueMonthCustomers.size,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
