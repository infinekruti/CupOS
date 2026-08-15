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
}

const DRINK_IMAGES: Record<string, { large: string; desc: string }> = {
  Espresso:        { large: '/espresso-large.png',       desc: 'Bold • Strong • Classic' },
  Cappuccino:      { large: '/cappuccino-large.png',     desc: 'Smooth • Rich • Perfect' },
  Latte:           { large: '/latte-large.png',          desc: 'Creamy • Mild • Comforting' },
  'Hot Chocolate': { large: '/hot-chocolate-large.png',  desc: 'Sweet • Warm • Indulgent' },
}

const S = {
  bg: '#0D0A08',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(200,146,42,0.15)',
  gold: '#C8922A',
  cream: '#F5F0E8',
  muted: '#C4B99A',
  font: "'Outfit', sans-serif",
}

export default function DrinkPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).single()
      .then(({ data }) => { setProduct(data); setLoading(false) })
  }, [id])

  const handleScanAndPay = () => {
    if (!product) return
    sessionStorage.setItem('cupos_cart', JSON.stringify([product.id]))
    router.push('/checkout')
  }

  const drinkInfo = product ? (DRINK_IMAGES[product.name] ?? { large: '/espresso-large.png', desc: 'Fresh & Delicious' }) : null

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100dvh', background: S.bg, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(200,146,42,0.2)', borderTopColor: S.gold, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ display: 'flex', minHeight: '100dvh', background: S.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: S.font }}>
        <p style={{ color: S.muted }}>Product not found.</p>
        <button onClick={() => router.push('/')} style={{ color: S.gold, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Go back</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg, fontFamily: S.font }}>

      {/* ── Header ── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 20px 8px' }}>
        <button id="back-btn" onClick={() => router.back()}
          style={{ color: S.muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ fontSize: 22, fontWeight: 800 }}>
          <span style={{ color: '#FFFFFF' }}>cup</span>
          <span style={{ background: 'linear-gradient(135deg, #E5A93C, #C8922A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
        </span>
        <div style={{ width: 34 }} />
      </header>

      {/* ── Drink Image ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 32px 0' }}>
        <div style={{
          width: 220, height: 220, borderRadius: '50%', overflow: 'hidden',
          border: '2px solid rgba(200,146,42,0.25)', background: '#1A1410',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(200,146,42,0.08)',
          marginBottom: 28,
        }}>
          <Image
            src={drinkInfo?.large ?? '/espresso-large.png'}
            alt={product.name}
            width={220} height={220}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <h1 style={{ color: S.cream, fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>{product.name}</h1>
        <p style={{ color: S.muted, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>{drinkInfo?.desc}</p>

        <p style={{ fontSize: 44, fontWeight: 800, textAlign: 'center', background: 'linear-gradient(135deg, #E5A93C, #C8922A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>
          ₹{Math.floor(product.price / 100)}
        </p>
      </div>

      {/* ── Actions ── */}
      <div style={{ padding: '24px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button id="scan-pay-btn" onClick={handleScanAndPay}
          style={{
            width: '100%', background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
            color: '#0D0A08', fontWeight: 700, fontSize: 17, padding: '16px 0',
            borderRadius: 18, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 8px 32px rgba(200,146,42,0.35)',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="18" y="14" width="3" height="3" rx="0.5"/><rect x="14" y="18" width="3" height="3" rx="0.5"/><rect x="18" y="18" width="3" height="3" rx="0.5"/>
          </svg>
          Scan &amp; Pay
        </button>

        <button id="cancel-btn" onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 14, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          Cancel
        </button>
      </div>

      <p style={{ textAlign: 'center', fontSize: 10, paddingBottom: 16 }}>
        <span style={{ color: '#FFFFFF' }}>cup</span>
        <span style={{ color: 'rgba(196,185,154,0.3)' }}>OS</span>
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
