import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''

  let query = supabaseAdmin
    .from('tokens')
    .select('id, token, status, created_at, expires_at, redeemed_at, order_id, phone, user_id, products(id, name, price)')
    .order('created_at', { ascending: false })
    .limit(150)

  if (search) query = query.ilike('token', `%${search}%`)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tokens: data })
}

export async function PATCH(req: NextRequest) {
  const { tokenId } = await req.json()
  const { error } = await supabaseAdmin
    .from('tokens')
    .update({ status: 'CANCELLED' })
    .eq('id', tokenId)
    .eq('status', 'UNUSED') // Only cancel unused tokens
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
