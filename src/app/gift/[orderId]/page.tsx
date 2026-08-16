'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { useRouter } from 'next/navigation'

type TokenData = {
  id: string
  token: string
  status: 'UNUSED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED'
  expires_at: string
  products: {
    id: string
    name: string
    price: number
  }
}

const DRINK_EMOJIS: Record<string, string> = {
  Espresso: '☕',
  Cappuccino: '🍵',
  Latte: '🥛',
  'Hot Chocolate': '🍫',
}

const DRINK_COLORS: Record<string, string> = {
  Espresso: '#6B3A2A',
  Cappuccino: '#8B5E3C',
  Latte: '#A0784A',
  'Hot Chocolate': '#5C3D2E',
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

export default function GiftPage({ params }: { params: { orderId: string } }) {
  const { orderId } = params
  const router = useRouter()
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [pollingStatus, setPollingStatus] = useState<Record<string, string>>({})
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchOrder() {
      const res = await fetch(`/api/order/${orderId}`)
      const data = await res.json()
      if (data.tokens) {
        setTokens(data.tokens)
        const status: Record<string, string> = {}
        data.tokens.forEach((t: TokenData) => { status[t.id] = t.status })
        setPollingStatus(status)
      }
      setLoading(false)
    }
    fetchOrder()

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/order/${orderId}`)
      const data = await res.json()
      if (data.tokens) {
        const status: Record<string, string> = {}
        data.tokens.forEach((t: TokenData) => { status[t.id] = t.status })
        setPollingStatus(status)
        setTokens(data.tokens)
      }
    }, 3000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [orderId])

  // Swipe gesture
  const touchStartX = useRef(0)
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeIndex < tokens.length - 1) setActiveIndex(i => i + 1)
      if (diff < 0 && activeIndex > 0) setActiveIndex(i => i - 1)
    }
  }

  const activeToken = tokens[activeIndex]
  const activeStatus = activeToken ? pollingStatus[activeToken.id] ?? activeToken.status : null
  const drinkName = activeToken?.products?.name ?? ''
  const drinkEmoji = DRINK_EMOJIS[drinkName] ?? '☕'
  const drinkAccent = DRINK_COLORS[drinkName] ?? '#6B3A2A'

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg, alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: S.font }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(200,146,42,0.2)', borderTopColor: S.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: S.muted, fontSize: 14 }}>Opening your gift...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────
  if (tokens.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px', gap: 16, fontFamily: S.font }}>
        <p style={{ color: S.cream }}>Gift link invalid or expired.</p>
        <button onClick={() => router.push('/')} style={{ color: S.gold, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: S.font }}>Go to cupOS Home</button>
      </div>
    )
  }

  // ── REDEEMED ─────────────────────────────────────────────
  if (activeStatus === 'REDEEMED') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg,
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: '0 32px', gap: 24, fontFamily: S.font,
        animation: 'fadeIn 0.4s ease-out',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%', border: '3px solid #22c55e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(34,197,94,0.3)',
        }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 48, marginBottom: 8 }}>{drinkEmoji}</p>
          <h2 style={{ color: S.cream, fontSize: 26, fontWeight: 700 }}>Gift Claimed!</h2>
          <p style={{ color: S.muted, fontSize: 14, marginTop: 8 }}>Enjoy your {drinkName}!</p>
        </div>
        {tokens.length > 1 && activeIndex < tokens.length - 1 && (
          <button
            onClick={() => setActiveIndex(i => Math.min(i + 1, tokens.length - 1))}
            style={{ color: S.gold, fontSize: 14, background: 'none', border: `1px solid ${S.border}`, borderRadius: 12, padding: '10px 20px', cursor: 'pointer', fontFamily: S.font }}
          >
            Next item →
          </button>
        )}
        <style>{`@keyframes fadeIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }`}</style>
      </div>
    )
  }

  // ── QR VIEW ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg, fontFamily: S.font }}>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '44px 20px 8px' }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>
          <span style={{ color: '#FFFFFF' }}>cup</span>
          <span style={{ background: 'linear-gradient(135deg, #E5A93C, #C8922A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
        </span>
      </header>

      {/* Dot pagination (multiple items) */}
      {tokens.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0 4px' }}>
          {tokens.map((t, i) => {
            const st = pollingStatus[t.id] ?? t.status
            return (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                style={{
                  width: i === activeIndex ? 24 : 8, height: 8, borderRadius: 4,
                  background: st === 'REDEEMED' ? '#22c55e' : i === activeIndex ? S.gold : 'rgba(200,146,42,0.3)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.3s',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Swipeable QR area */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 20px 24px' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {activeToken && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, animation: 'fadeUp 0.35s ease-out' }}>

            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: 'rgba(200,146,42,0.15)', border: `1px solid ${S.gold}`, padding: '6px 14px', borderRadius: 20, marginBottom: 12 }}>
                <span style={{ color: S.goldLight, fontWeight: 700, fontSize: 13 }}>🎁 YOU RECEIVED A GIFT!</span>
              </div>
              <div style={{ fontSize: 56, marginBottom: 4 }}>{drinkEmoji}</div>
              <h2 style={{ color: S.cream, fontSize: 28, fontWeight: 700 }}>{drinkName}</h2>
            </div>

            {/* QR card */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
              <div style={{
                position: 'absolute', inset: -2, borderRadius: 28,
                background: `linear-gradient(135deg, ${drinkAccent}60, rgba(200,146,42,0.4))`,
                filter: 'blur(12px)', zIndex: 0, animation: 'glowPulse 2.5s ease-in-out infinite',
              }} />
              <div style={{
                position: 'relative', zIndex: 1, background: 'rgba(26,20,16,0.95)',
                border: '1px solid rgba(200,146,42,0.25)', borderRadius: 24, padding: 20, backdropFilter: 'blur(20px)',
              }}>
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'center' }}>
                  <QRCode value={activeToken.token} size={220} style={{ width: '100%', height: 'auto' }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ color: S.cream, fontWeight: 700, fontSize: 16 }}>Scan at machine</p>
                  <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>To claim your free {drinkName}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.gold, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <p style={{ color: S.muted, fontSize: 13 }}>Waiting to be scanned...</p>
            </div>

            {/* Nav arrows for multiple items */}
            {tokens.length > 1 && (
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <button
                  onClick={() => setActiveIndex(i => Math.max(0, i - 1))} disabled={activeIndex === 0}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', background: S.card, border: `1px solid ${S.border}`,
                    color: S.muted, cursor: activeIndex === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: activeIndex === 0 ? 0.3 : 1,
                  }}
                ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
                <button
                  onClick={() => setActiveIndex(i => Math.min(tokens.length - 1, i + 1))} disabled={activeIndex === tokens.length - 1}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', background: S.card, border: `1px solid ${S.border}`,
                    color: S.muted, cursor: activeIndex === tokens.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: activeIndex === tokens.length - 1 ? 0.3 : 1,
                  }}
                ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>
              </div>
            )}
          </div>
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: 10, paddingBottom: 20 }}>
        <span style={{ color: '#FFFFFF' }}>cup</span><span style={{ color: 'rgba(196,185,154,0.25)' }}>OS</span>
      </p>

      <style>{`
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
