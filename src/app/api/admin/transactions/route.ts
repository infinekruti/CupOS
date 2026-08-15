import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from   = searchParams.get('from')
  const to     = searchParams.get('to')
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('transactions')
    .select('id, order_id, payment_id, payment_amount, payment_status, phone, user_id, created_at, product_ids')
    .order('created_at', { ascending: false })
    .limit(150)

  if (from)   query = query.gte('created_at', from)
  if (to)     query = query.lte('created_at', to)
  if (status) query = query.eq('payment_status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with product names
  const allPids = [...new Set((data ?? []).flatMap(t => t.product_ids ?? []))]
  const { data: products } = allPids.length
    ? await supabaseAdmin.from('products').select('id, name, price').in('id', allPids)
    : { data: [] }
  const pMap = Object.fromEntries((products ?? []).map(p => [p.id, p]))

  const enriched = (data ?? []).map(tx => ({
    ...tx,
    products: (tx.product_ids ?? []).map((id: string) => pMap[id]).filter(Boolean),
  }))

  return NextResponse.json({ transactions: enriched })
}
