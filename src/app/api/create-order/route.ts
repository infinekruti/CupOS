import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

/**
 * POST /api/create-order
 * Creates a Razorpay order before payment
 * Body: { productIds: string[], phone?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productIds, phone } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'No products specified' }, { status: 400 })
    }

    // Build quantity map from productIds (duplicates = quantity > 1, parsed for sizes)
    const qtyMap: Record<string, { full: number; half: number }> = {}
    for (const rawId of productIds) {
      const isHalf = rawId.endsWith('_half')
      const baseId = rawId.replace('_half', '').replace('_full', '')
      if (!qtyMap[baseId]) qtyMap[baseId] = { full: 0, half: 0 }
      if (isHalf) qtyMap[baseId].half++
      else qtyMap[baseId].full++
    }

    // Fetch prices for unique product IDs only
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('id, name, price, half_price')
      .in('id', Object.keys(qtyMap))

    if (error || !products) {
      return NextResponse.json({ error: 'Products not found' }, { status: 404 })
    }

    // Calculate total respecting quantities and sizes (prices are in paise)
    const totalAmount = products.reduce((sum, p) => {
      const q = qtyMap[p.id] || { full: 0, half: 0 }
      return sum + (p.price * q.full) + ((p.half_price || 0) * q.half)
    }, 0)

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: totalAmount,
      currency: 'INR',
      notes: {
        productIds: productIds.join(','),
        phone: phone ?? '',
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: totalAmount,
      currency: 'INR',
      products,
    })
  } catch (err) {
    console.error('[create-order]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
