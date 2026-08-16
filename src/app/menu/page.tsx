'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type Product = {
  id: string
  name: string
  description: string
  price: number
  active: boolean
  allow_half: boolean
  half_price: number
}

type Cart = Record<string, { full: number; half: number }> // productId → { full, half }

const DRINK_IMAGES: Record<string, string> = {
  Espresso: '/espresso.png',
  Cappuccino: '/cappuccino.png',
  Latte: '/latte.png',
  'Hot Chocolate': '/hot-chocolate.png',
}

const DRINK_EMOJIS: Record<string, string> = {
  Espresso: '☕',
  Cappuccino: '🍵',
  Latte: '🥛',
  'Hot Chocolate': '🍫',
}

const S = {
  bg: '#0D0A08',
  card: 'rgba(255,255,255,0.04)',
  cardHover: 'rgba(200,146,42,0.08)',
  border: 'rgba(200,146,42,0.12)',
  borderActive: 'rgba(200,146,42,0.5)',
  gold: '#C8922A',
  goldLight: '#E5A93C',
  cream: '#F5F0E8',
  muted: '#C4B99A',
  font: "'Outfit', sans-serif",
}

export default function MenuPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<Cart>({})

  const totalItems = Object.values(cart).reduce((s, sizes) => s + (sizes.full || 0) + (sizes.half || 0), 0)
  const totalPrice = products.reduce((s, p) => {
    const qtys = cart[p.id] || { full: 0, half: 0 }
    return s + (qtys.full * p.price) + (qtys.half * p.half_price)
  }, 0)

  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at')
      setProducts(data ?? [])
      setLoading(false)
    }
    fetchProducts()
  }, [])

  const increment = (id: string, isHalf: boolean) => {
    setCart(c => {
      const sizes = c[id] || { full: 0, half: 0 }
      return { ...c, [id]: { ...sizes, [isHalf ? 'half' : 'full']: sizes[isHalf ? 'half' : 'full'] + 1 } }
    })
  }

  const decrement = (id: string, isHalf: boolean) => {
    setCart(c => {
      if (!c[id]) return c
      const sizes = { ...c[id] }
      if (sizes[isHalf ? 'half' : 'full'] > 0) sizes[isHalf ? 'half' : 'full']--
      
      if (sizes.full === 0 && sizes.half === 0) {
        const next = { ...c }
        delete next[id]
        return next
      }
      return { ...c, [id]: sizes }
    })
  }

  const handleProceed = () => {
    const productIds: string[] = []
    for (const [id, sizes] of Object.entries(cart)) {
      for (let i = 0; i < sizes.full; i++) productIds.push(`${id}_full`)
      for (let i = 0; i < sizes.half; i++) productIds.push(`${id}_half`)
    }
    sessionStorage.setItem('cupos_cart', JSON.stringify(productIds))
    
    const meta: any[] = []
    products.forEach(p => {
      const sizes = cart[p.id]
      if (!sizes) return
      if (sizes.full > 0) meta.push({ id: `${p.id}_full`, name: p.name, price: p.price, qty: sizes.full, isHalf: false })
      if (sizes.half > 0) meta.push({ id: `${p.id}_half`, name: `Half ${p.name}`, price: p.half_price, qty: sizes.half, isHalf: true })
    })
    sessionStorage.setItem('cupos_cart_meta', JSON.stringify(meta))
    router.push('/checkout')
  }

  return (
    <div style={{ minHeight: '100dvh', background: S.bg, fontFamily: S.font, paddingBottom: totalItems > 0 ? 120 : 32 }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 8px' }}>
        <span style={{
          fontSize: 24, fontWeight: 800, letterSpacing: -0.5,
        }}>
          <span style={{ color: '#FFFFFF' }}>cup</span>
          <span style={{
            background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>OS</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Wallet */}
          <button
            onClick={() => router.push('/wallet')}
            title="My Wallet"
            style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.border}`,
              borderRadius: 10, padding: '8px 10px', color: S.muted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </button>

          {/* My Orders */}
          <button
            id="my-orders-btn"
            onClick={() => router.push('/orders')}
            title="My Orders"
            style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.border}`,
              borderRadius: 10, padding: '8px 10px', color: S.muted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </button>

          {/* Sign out */}
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              sessionStorage.removeItem('cupos_guest')
              router.push('/')
            }}
            style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.border}`,
              borderRadius: 10, padding: '6px 14px', color: S.muted,
              fontSize: 12, fontFamily: S.font, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Hero */}
      <div style={{ padding: '12px 20px 20px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: S.cream, lineHeight: 1.2 }}>
          What would you<br />like today?
        </h1>
        <p style={{ color: S.muted, fontSize: 14, marginTop: 6 }}>
          Select your drinks — add multiples of any item
        </p>
      </div>

      {/* Product List */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading
          ? [1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 88, borderRadius: 20, background: S.card, animation: 'pulse 1.5s infinite' }} />
            ))
          : products.map(product => {
              const qtys = cart[product.id] || { full: 0, half: 0 }
              const isInCart = qtys.full > 0 || qtys.half > 0
              return (
                <div
                  key={product.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 20,
                    background: isInCart ? 'rgba(200,146,42,0.09)' : S.card,
                    border: `1px solid ${isInCart ? S.borderActive : S.border}`,
                    transition: 'all 0.25s',
                  }}
                >
                  {/* Drink image */}
                  <div style={{
                    width: 58, height: 58, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                    border: `2px solid ${isInCart ? 'rgba(200,146,42,0.5)' : 'rgba(200,146,42,0.15)'}`,
                    background: '#1A1410', transition: 'border-color 0.25s',
                  }}>
                    <Image
                      src={DRINK_IMAGES[product.name] ?? '/espresso.png'}
                      alt={product.name}
                      width={58} height={58}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Info and Quantity Controls */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Full Size Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ color: S.cream, fontWeight: 600, fontSize: 16 }}>
                          {DRINK_EMOJIS[product.name] ?? '☕'} {product.name} {product.allow_half && <span style={{fontSize:12, color:S.muted, fontWeight:400}}>(Full)</span>}
                        </p>
                        <p style={{ color: S.muted, fontSize: 13, marginTop: 2 }}>
                          ₹{Math.floor(product.price / 100)}
                        </p>
                      </div>
                      
                      {/* Quantity control */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        {qtys.full > 0 ? (
                          <>
                            <button
                              id={`decrement-${product.id}-full`}
                              onClick={() => decrement(product.id, false)}
                              style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.08)', border: `1px solid ${S.border}`,
                                color: S.cream, fontSize: 20, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: S.font, lineHeight: 1,
                              }}
                            >−</button>
                            <span style={{ color: S.gold, fontWeight: 700, fontSize: 18, minWidth: 20, textAlign: 'center' }}>
                              {qtys.full}
                            </span>
                          </>
                        ) : null}
                        <button
                          id={`increment-${product.id}-full`}
                          onClick={() => increment(product.id, false)}
                          style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: qtys.full > 0
                              ? 'linear-gradient(135deg, #E5A93C, #C8922A)'
                              : 'rgba(200,146,42,0.15)',
                            border: `1px solid ${qtys.full > 0 ? 'transparent' : S.border}`,
                            color: qtys.full > 0 ? '#0D0A08' : S.gold,
                            fontSize: 20, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: S.font, lineHeight: 1, fontWeight: 700,
                            transition: 'all 0.2s',
                          }}
                        >+</button>
                      </div>
                    </div>

                    {/* Half Size Row */}
                    {product.allow_half && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
                        <div>
                          <p style={{ color: S.cream, fontWeight: 500, fontSize: 14 }}>
                            Half {product.name}
                          </p>
                          <p style={{ color: S.muted, fontSize: 12, marginTop: 2 }}>
                            ₹{Math.floor(product.half_price / 100)}
                          </p>
                        </div>
                        
                        {/* Quantity control */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                          {qtys.half > 0 ? (
                            <>
                              <button
                                id={`decrement-${product.id}-half`}
                                onClick={() => decrement(product.id, true)}
                                style={{
                                  width: 30, height: 30, borderRadius: '50%',
                                  background: 'rgba(255,255,255,0.08)', border: `1px solid ${S.border}`,
                                  color: S.cream, fontSize: 18, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontFamily: S.font, lineHeight: 1,
                                }}
                              >−</button>
                              <span style={{ color: S.gold, fontWeight: 700, fontSize: 16, minWidth: 20, textAlign: 'center' }}>
                                {qtys.half}
                              </span>
                            </>
                          ) : null}
                          <button
                            id={`increment-${product.id}-half`}
                            onClick={() => increment(product.id, true)}
                            style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: qtys.half > 0
                                ? 'linear-gradient(135deg, #E5A93C, #C8922A)'
                                : 'rgba(200,146,42,0.15)',
                              border: `1px solid ${qtys.half > 0 ? 'transparent' : S.border}`,
                              color: qtys.half > 0 ? '#0D0A08' : S.gold,
                              fontSize: 18, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: S.font, lineHeight: 1, fontWeight: 700,
                              transition: 'all 0.2s',
                            }}
                          >+</button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )
            })}
      </div>

      {/* Sticky Cart Bar */}
      {totalItems > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px 28px',
          background: 'linear-gradient(to top, #0D0A08 60%, transparent)',
        }}>
          <button
            id="proceed-to-pay-btn"
            onClick={handleProceed}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 20,
              background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: S.font, boxShadow: '0 8px 40px rgba(200,146,42,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                background: 'rgba(0,0,0,0.2)', borderRadius: 10,
                padding: '4px 10px', fontSize: 13, fontWeight: 700, color: '#0D0A08',
              }}>
                {totalItems} item{totalItems > 1 ? 's' : ''}
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#0D0A08' }}>
                Proceed to Pay
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#0D0A08' }}>
                ₹{Math.floor(totalPrice / 100)}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0D0A08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
    </div>
  )
}
