'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TokenItem = {
  id: string
  token: string
  status: 'UNUSED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED'
  expires_at: string
  redeemed_at: string | null
  order_id: string
  products: { id: string; name: string; price: number }
}

type Order = {
  orderId: string
  amount: number
  createdAt: string
  phone: string | null
  tokens: TokenItem[]
}

const DRINK_EMOJIS: Record<string, string> = {
  Espresso: '☕',
  Cappuccino: '🍵',
  Latte: '🥛',
  'Hot Chocolate': '🍫',
}

const STATUS_CONFIG = {
  UNUSED:    { label: 'Ready to use', color: '#C8922A', bg: 'rgba(200,146,42,0.12)', dot: '#C8922A' },
  REDEEMED:  { label: 'Redeemed',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  dot: '#22c55e' },
  EXPIRED:   { label: 'Expired',      color: '#6b7280', bg: 'rgba(107,114,128,0.1)', dot: '#6b7280' },
  CANCELLED: { label: 'Cancelled',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   dot: '#ef4444' },
}

const S = {
  bg: '#0D0A08',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(200,146,42,0.12)',
  gold: '#C8922A',
  goldLight: '#E5A93C',
  cream: '#F5F0E8',
  muted: '#C4B99A',
  font: "'Outfit', sans-serif",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function loadOrders() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      // Determine query param
      let queryParam = ''
      if (user?.id) {
        setUserName(user.user_metadata?.full_name || user.phone || 'You')
        queryParam = `userId=${user.id}`
      } else {
        // Guest — try phone from localStorage fallback
        const guestPhone = localStorage.getItem('cupos_phone')
        if (guestPhone) queryParam = `phone=${guestPhone}`
      }

      if (!queryParam) {
        setLoading(false)
        return
      }

      const res = await fetch(`/api/my-orders?${queryParam}`)
      const data = await res.json()
      setOrders(data.orders ?? [])
      setLoading(false)

      // Auto-expand most recent order
      if (data.orders?.length > 0) {
        setExpandedOrder(data.orders[0].orderId)
      }
    }
    loadOrders()
  }, [])

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg, alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: S.font }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(200,146,42,0.2)', borderTopColor: S.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: S.muted, fontSize: 14 }}>Loading your orders...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: S.bg, fontFamily: S.font, paddingBottom: 40 }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 20px 8px' }}>
        <button
          onClick={() => router.push('/menu')}
          style={{ color: S.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style={{ fontSize: 22, fontWeight: 800 }}>
          <span style={{ color: '#FFFFFF' }}>cup</span>
          <span style={{ background: 'linear-gradient(135deg, #E5A93C, #C8922A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
        </span>
        <div style={{ width: 34 }} />
      </header>

      <div style={{ padding: '16px 20px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: S.cream }}>My Orders</h1>
        {userName && (
          <p style={{ color: S.muted, fontSize: 14, marginTop: 4 }}>Welcome back, {userName}</p>
        )}
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 56 }}>☕</div>
          <p style={{ color: S.cream, fontWeight: 600, fontSize: 18 }}>No orders yet</p>
          <p style={{ color: S.muted, fontSize: 14 }}>Your order history will appear here after your first purchase.</p>
          <button
            onClick={() => router.push('/menu')}
            style={{
              marginTop: 8, padding: '12px 28px', borderRadius: 14,
              background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
              border: 'none', cursor: 'pointer',
              fontFamily: S.font, fontWeight: 700, fontSize: 15, color: '#0D0A08',
            }}
          >
            Order Now
          </button>
        </div>
      )}

      {/* Order list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orders.map(order => {
          const isExpanded = expandedOrder === order.orderId
          const unusedCount = order.tokens.filter(t => t.status === 'UNUSED').length
          const redeemedCount = order.tokens.filter(t => t.status === 'REDEEMED').length
          const totalItems = order.tokens.length

          return (
            <div
              key={order.orderId}
              style={{
                background: S.card, border: `1px solid ${isExpanded ? 'rgba(200,146,42,0.3)' : S.border}`,
                borderRadius: 20, overflow: 'hidden', transition: 'border-color 0.2s',
              }}
            >
              {/* Order header — always visible */}
              <button
                onClick={() => setExpandedOrder(isExpanded ? null : order.orderId)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: S.font,
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: S.cream, fontWeight: 700, fontSize: 15 }}>
                      {totalItems} drink{totalItems > 1 ? 's' : ''}
                    </span>
                    <span style={{ color: S.gold, fontWeight: 700, fontSize: 15 }}>
                      · ₹{Math.floor(order.amount / 100)}
                    </span>
                  </div>
                  <p style={{ color: S.muted, fontSize: 12 }}>{formatDate(order.createdAt)}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Status summary pills */}
                  {unusedCount > 0 && (
                    <span style={{
                      background: STATUS_CONFIG.UNUSED.bg, color: STATUS_CONFIG.UNUSED.color,
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    }}>
                      {unusedCount} active
                    </span>
                  )}
                  {redeemedCount > 0 && unusedCount === 0 && (
                    <span style={{
                      background: STATUS_CONFIG.REDEEMED.bg, color: STATUS_CONFIG.REDEEMED.color,
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    }}>
                      ✓ Done
                    </span>
                  )}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={S.muted} strokeWidth="2.2" strokeLinecap="round"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }}
                  >
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </button>

              {/* Expanded: drink list with status */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0 4px' }}>
                  {order.tokens.map((tok, idx) => {
                    const cfg = STATUS_CONFIG[tok.status] ?? STATUS_CONFIG.UNUSED
                    const name = tok.products?.name ?? 'Drink'
                    return (
                      <div
                        key={tok.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 18px',
                          borderBottom: idx < order.tokens.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 28 }}>{DRINK_EMOJIS[name] ?? '☕'}</span>
                          <div>
                            <p style={{ color: S.cream, fontWeight: 600, fontSize: 14 }}>{name}</p>
                            <p style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>
                              ₹{Math.floor((tok.products?.price ?? 0) / 100)}
                              {tok.redeemed_at && ` · ${formatDate(tok.redeemed_at)}`}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Status badge */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: cfg.bg, borderRadius: 20, padding: '4px 12px',
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                            <span style={{ color: cfg.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {cfg.label}
                            </span>
                          </div>

                          {/* Show QR button for unused tokens */}
                          {tok.status === 'UNUSED' && (
                            <button
                              onClick={() => router.push(`/order/${tok.order_id}`)}
                              style={{
                                background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
                                border: 'none', borderRadius: 10, padding: '6px 12px',
                                cursor: 'pointer', fontFamily: S.font, fontWeight: 600,
                                fontSize: 11, color: '#0D0A08', whiteSpace: 'nowrap',
                              }}
                            >
                              Show QR
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
