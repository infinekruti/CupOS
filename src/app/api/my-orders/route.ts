import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/my-orders
 * Returns all orders for the authenticated user (by user_id or phone)
 * Query params: ?userId=xxx  OR  ?phone=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const phone  = searchParams.get('phone')

    if (!userId && !phone) {
      return NextResponse.json({ error: 'userId or phone required' }, { status: 400 })
    }

    // Build query — prefer userId, fallback to phone
    let query = supabaseAdmin
      .from('transactions')
      .select('order_id, payment_amount, created_at, phone, token_ids')
      .order('created_at', { ascending: false })
      .limit(20)

    if (userId) {
      query = query.eq('user_id', userId)
    } else if (phone) {
      query = query.eq('phone', phone)
    }

    const { data: transactions, error: txError } = await query
    if (txError) throw txError
    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ orders: [] })
    }

    // Fetch all tokens for these transactions
    const allTokenIds = transactions.flatMap(t => t.token_ids ?? [])
    const { data: tokens, error: tokError } = await supabaseAdmin
      .from('tokens')
      .select('id, token, status, expires_at, redeemed_at, order_id, products(id, name, price)')
      .in('id', allTokenIds)

    if (tokError) throw tokError

    // Group tokens by order_id
    const tokensByOrder: Record<string, typeof tokens> = {}
    for (const tok of tokens ?? []) {
      if (!tokensByOrder[tok.order_id]) tokensByOrder[tok.order_id] = []
      tokensByOrder[tok.order_id]!.push(tok)
    }

    // Assemble response
    const orders = transactions.map(tx => ({
      orderId:       tx.order_id,
      amount:        tx.payment_amount,
      createdAt:     tx.created_at,
      phone:         tx.phone,
      tokens:        tokensByOrder[tx.order_id] ?? [],
    }))

    return NextResponse.json({ orders })
  } catch (err) {
    console.error('[my-orders]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
