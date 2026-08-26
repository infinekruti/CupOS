'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}
type RazorpayOptions = {
  key: string; amount: number; currency: string; name: string; description: string;
  order_id: string; handler: (r: RazorpayResponse) => void;
  prefill?: { contact?: string }; theme?: { color?: string };
  modal?: { ondismiss?: () => void }
}
type RazorpayInstance = { open: () => void }
type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }

type CartItem = { id: string; name: string; price: number; qty: number }

const DRINK_EMOJIS: Record<string, string> = {
  Espresso: '☕',
  Cappuccino: '🍵',
  Latte: '🥛',
  'Hot Chocolate': '🍫',
}

const S = {
  bg: '#0D0A08',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(200,146,42,0.15)',
  gold: '#C8922A',
  goldLight: '#E5A93C',
  cream: '#F5F0E8',
  muted: '#C4B99A',
  font: "'Outfit', sans-serif",
}

export default function CheckoutPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [productIds, setProductIds] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'idle' | 'paying' | 'verifying' | 'error'>('idle')

  useEffect(() => {
    // Get auth session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id)
        fetch(`/api/wallet/balance?userId=${data.session.user.id}`)
          .then(r => r.json())
          .then(d => setWalletBalance(d.balance || 0))
      }
    })

    const savedPhone = localStorage.getItem('cupos_phone')
    if (savedPhone) setPhone(savedPhone)

    // Load raw productIds for payment
    const cart: string[] = JSON.parse(sessionStorage.getItem('cupos_cart') ?? '[]')
    if (cart.length === 0) { router.push('/menu'); return }
    setProductIds(cart)

    // Load display metadata
    const meta: CartItem[] = JSON.parse(sessionStorage.getItem('cupos_cart_meta') ?? '[]')
    if (meta.length > 0) {
      setCartItems(meta)
    } else {
      // Fallback: build from raw ids
      fetch(`/api/products?ids=${[...new Set(cart)].join(',')}`)
        .then(r => r.json())
        .then(d => {
          const counts: Record<string, number> = {}
          cart.forEach(id => { counts[id] = (counts[id] ?? 0) + 1 })
          setCartItems((d.products ?? []).map((p: { id: string; name: string; price: number }) => ({
            ...p, qty: counts[p.id] ?? 1,
          })))
        })
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.body.appendChild(script)
  }, [router])

  const total = cartItems.reduce((s, item) => s + item.price * item.qty, 0)

  const handlePay = async () => {
    setLoading(true)
    setStep('paying')
    try {
      const orderRes = await fetch('/api/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, phone: phone || undefined }),
      })
      const orderData = await orderRes.json()

      const rzp = new window.Razorpay({
        key: 'rzp_live_TUYkUUvXm46yrt', // Live key hardcoded to bypass Vercel build cache
        amount: orderData.amount, currency: 'INR',
        name: 'cupOS',
        description: cartItems.map(i => `${i.qty}× ${i.name}`).join(', '),
        order_id: orderData.orderId,
        prefill: { contact: phone || undefined },
        theme: { color: '#C8922A' },
        modal: {
          ondismiss: () => { setStep('idle'); setLoading(false) },
        },
        handler: async (response: RazorpayResponse) => {
          setStep('verifying')
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              productIds,
              phone: phone || undefined,
              amount: total,
              userId: userId ?? undefined,
            }),
          })
          const v = await verifyRes.json()
          if (v.success) {
            sessionStorage.removeItem('cupos_cart')
            sessionStorage.removeItem('cupos_cart_meta')
            if (phone) localStorage.setItem('cupos_phone', phone)
            router.push(`/order/${v.orderId}`)
          } else {
            setStep('error')
          }
        },
      })
      rzp.open()
    } catch {
      setStep('error')
      setLoading(false)
    }
  }

  const handleWalletPay = async () => {
    setLoading(true)
    setStep('paying')
    try {
      const res = await fetch('/api/wallet/pay', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, phone: phone || undefined, amount: total, userId }),
      })
      const data = await res.json()
      if (data.success) {
        sessionStorage.removeItem('cupos_cart')
        sessionStorage.removeItem('cupos_cart_meta')
        if (phone) localStorage.setItem('cupos_phone', phone)
        router.push(`/order/${data.orderId}`)
      } else {
        setStep('error')
        setLoading(false)
      }
    } catch {
      setStep('error')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg, fontFamily: S.font }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '44px 20px 8px' }}>
        <button
          onClick={() => router.back()}
          style={{ color: S.muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 6 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style={{
          fontSize: 22, fontWeight: 800,
        }}>
          <span style={{ color: '#FFFFFF' }}>cup</span>
          <span style={{
            background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>OS</span>
        </span>
        <div style={{ width: 34 }} />
      </header>

      {/* ── IDLE — Order Summary ── */}
      {step === 'idle' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 0' }}>

          <h2 style={{ color: S.cream, fontSize: 26, fontWeight: 700, marginBottom: 20 }}>Your Order</h2>

          {/* Items */}
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
            {cartItems.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderBottom: idx < cartItems.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{DRINK_EMOJIS[item.name] ?? '☕'}</span>
                  <div>
                    <p style={{ color: S.cream, fontWeight: 600, fontSize: 15 }}>{item.name}</p>
                    <p style={{ color: S.muted, fontSize: 12, marginTop: 2 }}>₹{Math.floor(item.price / 100)} × {item.qty}</p>
                  </div>
                </div>
                <span style={{ color: S.gold, fontWeight: 700, fontSize: 16 }}>
                  ₹{Math.floor((item.price * item.qty) / 100)}
                </span>
              </div>
            ))}

            {/* Total row */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 18px', background: 'rgba(200,146,42,0.06)',
              borderTop: '1px solid rgba(200,146,42,0.2)',
            }}>
              <span style={{ color: S.cream, fontWeight: 700, fontSize: 16 }}>Total</span>
              <span style={{ color: S.goldLight, fontWeight: 800, fontSize: 22 }}>
                ₹{Math.floor(total / 100)}
              </span>
            </div>
          </div>

          {/* Phone (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 8 }}>
              Phone (optional)
            </label>
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
              <span style={{ color: S.muted, fontSize: 14 }}>+91</span>
              <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
              <input
                id="phone-input"
                type="tel"
                placeholder="Mobile number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                maxLength={10}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: S.cream, fontSize: 14, fontFamily: S.font }}
              />
            </div>
            <p style={{ color: 'rgba(196,185,154,0.4)', fontSize: 11, marginTop: 6 }}>
              We'll save your QR if you lose it. No spam.
            </p>
          </div>

          <div style={{ flex: 1 }} />

          {/* Pay button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
            {walletBalance >= total && (
              <button
                onClick={handleWalletPay}
                disabled={loading || cartItems.length === 0}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  color: S.goldLight, fontWeight: 700, fontSize: 17,
                  padding: '18px 0', borderRadius: 18, border: `1px solid ${S.border}`, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                Pay via Wallet (₹{Math.floor(total / 100)})
              </button>
            )}

            <button
              id="pay-btn"
              onClick={handlePay}
              disabled={loading || cartItems.length === 0}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
                color: '#0D0A08', fontWeight: 700, fontSize: 17,
                padding: '18px 0', borderRadius: 18, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 8px 40px rgba(200,146,42,0.45)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              Pay ₹{Math.floor(total / 100)} via UPI
            </button>
          </div>
        </div>
      )}

      {/* PAYING */}
      {step === 'paying' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, border: '3px solid rgba(200,146,42,0.2)', borderTopColor: S.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: S.muted, fontSize: 14 }}>Opening payment...</p>
        </div>
      )}

      {/* VERIFYING */}
      {step === 'verifying' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, border: '3px solid rgba(200,146,42,0.2)', borderTopColor: S.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: S.muted, fontSize: 14 }}>Confirming payment...</p>
        </div>
      )}

      {/* ERROR */}
      {step === 'error' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 52 }}>❌</div>
          <p style={{ color: S.cream, fontWeight: 600 }}>Payment failed</p>
          <button
            onClick={() => { setStep('idle'); setLoading(false) }}
            style={{ color: S.gold, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Try again
          </button>
        </div>
      )}

      <p style={{ textAlign: 'center', color: 'rgba(196,185,154,0.3)', fontSize: 10, padding: '8px 0 20px' }}>
        Secured by Razorpay
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
