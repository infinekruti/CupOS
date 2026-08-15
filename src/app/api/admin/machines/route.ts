import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('*')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ machines: data })
}

export async function PATCH(req: NextRequest) {
  const { machineId, status } = await req.json()
  const { error } = await supabaseAdmin
    .from('machines')
    .update({ status })
    .eq('id', machineId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
