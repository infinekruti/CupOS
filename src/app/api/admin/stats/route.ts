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
      supabaseAdmin.from('transactions').select('payment_id, payment_amount, user_id, phone, created_at, payment_status').gte('created_at', todayISO),
      supabaseAdmin.from('transactions').select('payment_id, payment_amount, user_id, phone, created_at, payment_status').gte('created_at', monthISO),
      supabaseAdmin.from('tokens').select('id, is_half, created_at, status, products(name)').gte('created_at', monthISO),
      supabaseAdmin.from('wallet_transactions').select('amount').eq('type', 'admin_credit')
    ])

    const onlineMachines = machines?.filter(m => m.status === 'online').length ?? 0
    const uniqueMonthCustomers = new Set([
      ...(monthTx?.map(t => t.user_id).filter(Boolean) ?? []),
      ...(monthTx?.map(t => t.phone).filter(Boolean) ?? []),
    ])

    const coffeeToday = monthTokens?.filter(t => t.status === 'REDEEMED' && t.created_at >= todayISO).length ?? 0

    // Filter out transactions that have been completely refunded or have 0 payment_amount
    const validTodayTx = todayTx?.filter(t => t.payment_status !== 'refunded' && t.payment_amount > 0) ?? []
    const todayDirectTx = validTodayTx.filter(t => t.payment_id !== 'wallet')
    const todayWalletTx = validTodayTx.filter(t => t.payment_id === 'wallet')

    const revenueToday = todayDirectTx.reduce((s, t) => s + t.payment_amount, 0)
    const ordersToday = todayDirectTx.length

    const walletRedemptionToday = todayWalletTx.reduce((s, t) => s + t.payment_amount, 0)
    const walletOrdersToday = todayWalletTx.length

    const totalSalesToday = revenueToday + walletRedemptionToday

    // Monthly Direct vs Wallet Redemptions (excluding refunded transactions)
    const validMonthTx = monthTx?.filter(t => t.payment_status !== 'refunded' && t.payment_amount > 0) ?? []
    const monthDirectTx = validMonthTx.filter(t => t.payment_id !== 'wallet')
    const monthWalletTx = validMonthTx.filter(t => t.payment_id === 'wallet')

    const revenueMonth = monthDirectTx.reduce((s, t) => s + t.payment_amount, 0)
    const ordersMonth = monthDirectTx.length

    const walletRedemptionMonth = monthWalletTx.reduce((s, t) => s + t.payment_amount, 0)
    const walletOrdersMonth = monthWalletTx.length

    const totalSalesMonth = revenueMonth + walletRedemptionMonth

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

    // 7-day revenue trend with separate Direct Revenue and Wallet Redemption
    const last7Days: {
      date: string
      revenue: number
      directRevenue: number
      walletRedemption: number
      orders: number
      walletOrders: number
    }[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      last7Days.push({
        date: dateStr,
        revenue: 0,
        directRevenue: 0,
        walletRedemption: 0,
        orders: 0,
        walletOrders: 0
      })
    }

    validMonthTx.forEach(tx => {
      const dateStr = tx.created_at.split('T')[0]
      const day = last7Days.find(d => d.date === dateStr)
      if (day) {
        if (tx.payment_id === 'wallet') {
          day.walletRedemption += tx.payment_amount
          day.walletOrders++
        } else {
          day.directRevenue += tx.payment_amount
          day.revenue += tx.payment_amount // pure revenue excluding wallet expenses
          day.orders++
        }
      }
    })

    return NextResponse.json({
      totalMachines:         machines?.length ?? 0,
      onlineMachines,
      offlineMachines:       (machines?.length ?? 0) - onlineMachines,
      revenueToday,          // Direct gateway revenue today
      ordersToday,           // Direct orders count
      walletRedemptionToday, // Wallet balance redeemed today
      walletOrdersToday,     // Wallet orders count
      totalSalesToday,       // Total order value (direct + wallet)
      revenueMonth,          // Direct gateway revenue this month
      ordersMonth,
      walletRedemptionMonth, // Wallet balance redeemed this month
      walletOrdersMonth,
      totalSalesMonth,
      totalWalletCredit:     walletCredits?.reduce((s, t) => s + t.amount, 0) ?? 0,
      coffeeToday,
      activeCustomers:       uniqueMonthCustomers.size,
      productStats:          Object.entries(productStats).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.total - a.total),
      sizeStats:             { full: totalFull, half: totalHalf },
      revenueTrend:          last7Days,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
