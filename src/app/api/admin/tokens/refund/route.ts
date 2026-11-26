import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tokens/refund
 * 
 * Atomically marks an UNUSED token as CANCELLED, and processes accounting:
 * - 'wallet': Credits the token price back to the user's CupOS wallet and logs wallet_transactions
 * - 'direct': Adjusts transaction payment_amount and revenue accounting
 * - 'none': Cancels token without monetary adjustment
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tokenId, refundType = 'wallet', reason = '' } = body

    if (!tokenId) {
      return NextResponse.json({ error: 'Missing tokenId' }, { status: 400 })
    }

    // 1. Fetch token and associated product details
    const { data: token, error: tokenErr } = await supabaseAdmin
      .from('tokens')
      .select('id, token, status, order_id, user_id, phone, is_half, product_id, products(id, name, price, half_price)')
      .eq('id', tokenId)
      .single()

    if (tokenErr || !token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 })
    }

    if (token.status !== 'UNUSED') {
      return NextResponse.json({
        error: `Token cannot be refunded because it is already ${token.status}. Only UNUSED tokens can be refunded.`
      }, { status: 400 })
    }

    // 2. Determine price of the token in paise
    const product = token.products as any
    const isHalf = Boolean(token.is_half)
    const tokenPrice: number = isHalf && product?.half_price ? product.half_price : (product?.price ?? 0)

    // 3. Find the associated transaction record (if any)
    const { data: tx } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('order_id', token.order_id)
      .maybeSingle()

    const userId = token.user_id || tx?.user_id || null

    // 4. Atomically mark the token as CANCELLED
    const { data: updatedToken, error: cancelErr } = await supabaseAdmin
      .from('tokens')
      .update({ status: 'CANCELLED' })
      .eq('id', token.id)
      .eq('status', 'UNUSED') // Atomic guard: ensure still UNUSED
      .select('id, token, status')

    if (cancelErr || !updatedToken || updatedToken.length === 0) {
      return NextResponse.json({
        error: 'Failed to cancel token. It may have just been redeemed or cancelled by another process.'
      }, { status: 409 })
    }

    let accountingSummary = ''
    let newWalletBalance: number | null = null

    // 5. Accounting execution based on refundType
    if (refundType === 'wallet') {
      if (!userId) {
        return NextResponse.json({
          error: 'Cannot refund to wallet because this purchase is not linked to a registered customer account. Please choose Direct / Cash refund.'
        }, { status: 400 })
      }

      // 5a. Fetch or initialize wallet
      let { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle()

      if (!wallet) {
        const { data: newW, error: createWErr } = await supabaseAdmin
          .from('wallets')
          .insert({ user_id: userId, balance: 0 })
          .select('balance')
          .single()
        if (createWErr) throw createWErr
        wallet = newW
      }

      const prevBalance = wallet?.balance ?? 0
      newWalletBalance = prevBalance + tokenPrice

      // 5b. Update wallet balance
      const { error: wUpdateErr } = await supabaseAdmin
        .from('wallets')
        .update({
          balance: newWalletBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (wUpdateErr) throw wUpdateErr

      // 5c. Insert audit record in wallet_transactions
      const refNote = reason ? `${token.token} (${reason})` : token.token
      await supabaseAdmin.from('wallet_transactions').insert({
        user_id: userId,
        amount: tokenPrice,
        type: 'refund',
        reference_id: refNote,
      })

      // 5d. If there is a transaction record for this order, adjust its accounting
      if (tx) {
        const updatedPaymentAmount = Math.max(0, (tx.payment_amount || 0) - tokenPrice)
        const updatedPaymentStatus = updatedPaymentAmount === 0 ? 'refunded' : tx.payment_status

        await supabaseAdmin
          .from('transactions')
          .update({
            payment_amount: updatedPaymentAmount,
            payment_status: updatedPaymentStatus,
          })
          .eq('id', tx.id)
      }

      accountingSummary = `Refunded ₹${(tokenPrice / 100).toFixed(2)} to customer wallet. New balance: ₹${(((newWalletBalance ?? 0)) / 100).toFixed(2)}.`

    } else if (refundType === 'direct') {
      // 5e. Direct / Gateway Refund: Deduct from transactions table to reflect accurate net revenue
      if (tx) {
        const updatedPaymentAmount = Math.max(0, (tx.payment_amount || 0) - tokenPrice)
        const updatedPaymentStatus = updatedPaymentAmount === 0 ? 'refunded' : tx.payment_status

        await supabaseAdmin
          .from('transactions')
          .update({
            payment_amount: updatedPaymentAmount,
            payment_status: updatedPaymentStatus,
          })
          .eq('id', tx.id)

        accountingSummary = `Adjusted transaction ${tx.order_id}: deducted ₹${(tokenPrice / 100).toFixed(2)} from revenue accounting.`
      } else {
        accountingSummary = `Direct refund of ₹${(tokenPrice / 100).toFixed(2)} recorded.`
      }

    } else {
      accountingSummary = 'Token cancelled without monetary refund.'
    }

    return NextResponse.json({
      success: true,
      token: token.token,
      refundedAmount: tokenPrice,
      refundType,
      newWalletBalance,
      message: accountingSummary,
    })

  } catch (err: any) {
    console.error('[admin/tokens/refund]', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
