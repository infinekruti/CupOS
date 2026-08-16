import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    const monthISO = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

    const [
      { data: machines },
      { data: todayTx },
      { data: monthTx },
      { data: monthTokens },
      { data: walletCredits },
    ] = await Promise.all([
      supabaseAdmin.from('machines').select('id, status'),
      supabaseAdmin.from('transactions').select('payment_amount, user_id, phone').gte('created_at', todayISO),
      supabaseAdmin.from('transactions').select('payment_amount, user_id, phone, created_at').gte('created_at', monthISO),
      supabaseAdmin.from('tokens').select('id, is_half, created_at, status, products(name)').gte('created_at', monthISO),
      supabaseAdmin.from('wallet_transactions').select('amount').eq('type', 'admin_credit')
    ])

    const onlineMachines = machines?.filter(m => m.status === 'online').length ?? 0
    const uniqueMonthCustomers = new Set([
      ...(monthTx?.map(t => t.user_id).filter(Boolean) ?? []),
      ...(monthTx?.map(t => t.phone).filter(Boolean) ?? []),
    ])

    const coffeeToday = monthTokens?.filter(t => t.status === 'REDEEMED' && t.created_at >= todayISO).length ?? 0

    // Product breakdown
    const productStats: Record<string, { full: number; half: number; total: number }> = {}
    let totalHalf = 0
    let totalFull = 0
    monthTokens?.forEach(t => {
      const name = (t.products as any)?.name ?? 'Unknown'
      if (!productStats[name]) productStats[name] = { full: 0, half: 0, total: 0 }
      if (t.is_half) { productStats[name].half++; totalHalf++ }
      else { productStats[name].full++; totalFull++ }
      productStats[name].total++
    })

    // 7-day revenue trend
    const last7Days: { date: string; revenue: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      last7Days.push({ date: dateStr, revenue: 0 })
    }
    monthTx?.forEach(tx => {
      const dateStr = tx.created_at.split('T')[0]
      const day = last7Days.find(d => d.date === dateStr)
      if (day) day.revenue += tx.payment_amount
    })

    return NextResponse.json({
      totalMachines:    machines?.length ?? 0,
      onlineMachines,
      offlineMachines:  (machines?.length ?? 0) - onlineMachines,
      revenueToday:     todayTx?.reduce((s, t) => s + t.payment_amount, 0) ?? 0,
      ordersToday:      todayTx?.length ?? 0,
      revenueMonth:     monthTx?.reduce((s, t) => s + t.payment_amount, 0) ?? 0,
      totalWalletCredit: walletCredits?.reduce((s, t) => s + t.amount, 0) ?? 0,
      coffeeToday,
      activeCustomers:  uniqueMonthCustomers.size,
      productStats:     Object.entries(productStats).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.total - a.total),
      sizeStats:        { full: totalFull, half: totalHalf },
      revenueTrend:     last7Days,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
