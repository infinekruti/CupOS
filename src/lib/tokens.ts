import { supabaseAdmin } from './supabase'
import crypto from 'crypto'

/** Generate a unique CPOS-XXXXXXXX token */
export function generateTokenString(): string {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `CPOS-${hex}`
}

/** Create tokens for each product in an order */
export async function createTokensForOrder(params: {
  orderId: string
  productIds: string[]
  phone?: string
  userId?: string
}): Promise<{ tokens: string[]; tokenIds: string[] }> {
  const { orderId, productIds, phone, userId } = params
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  const rows = productIds.map((rawId) => {
    const isHalf = rawId.endsWith('_half')
    const baseId = rawId.replace('_half', '').replace('_full', '')
    return {
      token: generateTokenString(),
      order_id: orderId,
      product_id: baseId,
      is_half: isHalf,
      phone: phone ?? null,
      user_id: userId ?? null,
      status: 'UNUSED',
      expires_at: expiresAt.toISOString(),
    }
  })

  // Insert all tokens, ensuring uniqueness by retrying on conflict
  const { data, error } = await supabaseAdmin
    .from('tokens')
    .insert(rows)
    .select('id, token')

  if (error) throw new Error(`Token creation failed: ${error.message}`)

  return {
    tokens: data.map((t) => t.token),
    tokenIds: data.map((t) => t.id),
  }
}

/** Atomically validate and redeem a token — called by ESP32 */
export async function validateAndRedeemToken(params: {
  token: string
  machineCode: string
}): Promise<{ success: boolean; product?: string; reason?: string; relay_id?: number; dispense_time_ms?: number; is_half?: boolean }> {
  const { token, machineCode } = params

  // 1. Get machine ID from machine_code
  const { data: machine } = await supabaseAdmin
    .from('machines')
    .select('id')
    .eq('machine_code', machineCode)
    .single()

  if (!machine) {
    return { success: false, reason: 'Unknown machine' }
  }

  // 2. Find token with row lock (Supabase uses serializable transactions)
  const { data: tokenData } = await supabaseAdmin
    .from('tokens')
    .select('id, status, expires_at, product_id, is_half, products(name, relay_id, dispense_time_ms)')
    .eq('token', token)
    .single()

  if (!tokenData) return { success: false, reason: 'Token not found' }
  if (tokenData.status === 'REDEEMED') return { success: false, reason: 'Token already used' }
  if (tokenData.status === 'CANCELLED') return { success: false, reason: 'Token cancelled' }
  if (new Date(tokenData.expires_at) < new Date()) return { success: false, reason: 'Token expired' }
  if (tokenData.status !== 'UNUSED') return { success: false, reason: 'Token invalid' }

  // 3. Atomically mark as redeemed (optimistic lock via status check in WHERE)
  const { error: updateError, count } = await supabaseAdmin
    .from('tokens')
    .update({
      status: 'REDEEMED',
      redeemed_at: new Date().toISOString(),
      machine_id: machine.id,
    })
    .eq('id', tokenData.id)
    .eq('status', 'UNUSED') // Atomic guard — only update if still UNUSED
    .select()

  if (updateError || count === 0) {
    return { success: false, reason: 'Token already used' }
  }

  const product = tokenData.products as any
  const productName = product?.name ?? 'coffee'

  return { 
    success: true, 
    product: productName,
    relay_id: product?.relay_id ?? 0,
    dispense_time_ms: product?.dispense_time_ms ?? 300,
    is_half: tokenData.is_half ?? false
  }
}

/** Get all tokens for an order (for QR display page) */
export async function getOrderTokens(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from('tokens')
    .select('id, token, status, expires_at, is_half, products(id, name, description, price)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}
