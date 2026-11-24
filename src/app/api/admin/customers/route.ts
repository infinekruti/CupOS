import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') || '').toLowerCase().trim()
    const walletFilter = searchParams.get('wallet') || 'all'
    const spentFilter = searchParams.get('spent') || 'all'
    const sort = searchParams.get('sort') || 'joined_desc'

    // 1. Fetch all users from Supabase Auth (fetch up to 1000 users)
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (usersError) throw usersError

    // 2. Fetch all wallets
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('user_id, balance')
    
    const walletMap = new Map((wallets || []).map(w => [w.user_id, w.balance]))

    // 3. Fetch all successful transactions
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('id, order_id, payment_id, user_id, phone, payment_amount, created_at')
      .eq('payment_status', 'paid')

    // Aggregate spending, order counts, and order histories per user (matching user_id or phone)
    const spentMap = new Map<string, number>()
    const directSpentMap = new Map<string, number>()
    const walletSpentMap = new Map<string, number>()
    const orderCountMap = new Map<string, number>()
    const lastOrderMap = new Map<string, string>()
    const ordersByUser = new Map<string, Array<{ id: string; order_id: string; payment_id: string; payment_amount: number; created_at: string }>>()

    if (transactions) {
      transactions.forEach(t => {
        const uid = t.user_id
        if (!uid) return

        const currentSpent = spentMap.get(uid) || 0
        spentMap.set(uid, currentSpent + t.payment_amount)

        if (t.payment_id === 'wallet') {
          walletSpentMap.set(uid, (walletSpentMap.get(uid) || 0) + t.payment_amount)
        } else {
          directSpentMap.set(uid, (directSpentMap.get(uid) || 0) + t.payment_amount)
        }

        orderCountMap.set(uid, (orderCountMap.get(uid) || 0) + 1)

        const existingLast = lastOrderMap.get(uid)
        if (!existingLast || t.created_at > existingLast) {
          lastOrderMap.set(uid, t.created_at)
        }

        const list = ordersByUser.get(uid) || []
        list.push({
          id: t.id,
          order_id: t.order_id,
          payment_id: t.payment_id,
          payment_amount: t.payment_amount,
          created_at: t.created_at,
        })
        ordersByUser.set(uid, list)
      })
    }

    // 4. Map customers
    let customers = users.map(user => {
      const phone = user.phone || user.user_metadata?.phone || null
      const email = user.email || null
      const name = user.user_metadata?.full_name || user.user_metadata?.name || 'Customer'
      const avatar_url = user.user_metadata?.avatar_url || user.user_metadata?.picture || null
      const total_spent = spentMap.get(user.id) || 0
      const direct_spent = directSpentMap.get(user.id) || 0
      const wallet_spent = walletSpentMap.get(user.id) || 0
      const order_count = orderCountMap.get(user.id) || 0
      const last_order_at = lastOrderMap.get(user.id) || null
      const userOrders = (ordersByUser.get(user.id) || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      return {
        id: user.id,
        name,
        email,
        phone,
        avatar_url,
        created_at: user.created_at,
        wallet_balance: walletMap.get(user.id) || 0,
        total_spent,
        direct_spent,
        wallet_spent,
        order_count,
        last_order_at,
        recent_orders: userOrders.slice(0, 5),
      }
    })

    // 5. Server-side Filtering (if query params passed)
    if (search) {
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(search) ||
        (c.phone && c.phone.toLowerCase().includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        c.id.toLowerCase().includes(search)
      )
    }

    if (walletFilter === 'has_balance') {
      customers = customers.filter(c => c.wallet_balance > 0)
    } else if (walletFilter === 'zero_balance') {
      customers = customers.filter(c => c.wallet_balance === 0)
    } else if (walletFilter === 'high_balance') {
      customers = customers.filter(c => c.wallet_balance >= 10000) // >= ₹100
    }

    if (spentFilter === 'has_spent') {
      customers = customers.filter(c => c.total_spent > 0)
    } else if (spentFilter === 'high_spent') {
      customers = customers.filter(c => c.total_spent >= 50000) // >= ₹500
    } else if (spentFilter === 'zero_spent') {
      customers = customers.filter(c => c.total_spent === 0)
    }

    // 6. Sorting
    if (sort === 'joined_asc') {
      customers.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else if (sort === 'wallet_desc') {
      customers.sort((a, b) => b.wallet_balance - a.wallet_balance)
    } else if (sort === 'spent_desc') {
      customers.sort((a, b) => b.total_spent - a.total_spent)
    } else if (sort === 'orders_desc') {
      customers.sort((a, b) => b.order_count - a.order_count)
    } else if (sort === 'name_asc') {
      customers.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      // Default: joined_desc
      customers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return NextResponse.json({
      customers,
      totalCount: users.length,
      filteredCount: customers.length,
    })
  } catch (err) {
    console.error('[admin/customers]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
