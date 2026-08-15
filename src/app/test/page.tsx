'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'react-qr-code'
import { supabase } from '@/lib/supabase'

type Product = { id: string; name: string; price: number }
type TokenResult = { token: string; orderId: string }

const LOCAL_IP = '192.168.29.161'
const PORT = '3000'
const API_BASE = `http://${LOCAL_IP}:${PORT}`

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

export default function TestPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TokenResult | null>(null)
  const [validateResult, setValidateResult] = useState<{ success: boolean; reason?: string; product?: string } | null>(null)
  const [validating, setValidating] = useState(false)
  const [machineId, setMachineId] = useState('INDORE-001')
  const [pollingStatus, setPollingStatus] = useState<string | null>(null)
  const pollRef = { current: null as NodeJS.Timeout | null }

  useEffect(() => {
    supabase.from('products').select('id, name, price').eq('active', true).then(({ data }) => {
      setProducts(data ?? [])
      if (data && data.length > 0) setSelectedProduct(data[0])
    })
  }, [])

  // Poll token status after generation
  useEffect(() => {
    if (!result) return
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('tokens')
        .select('status')
        .eq('token', result.token)
        .single()
      if (data) setPollingStatus(data.status)
      if (data?.status === 'REDEEMED') clearInterval(pollRef.current!)
    }, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [result])

  const generateToken = async () => {
    if (!selectedProduct) return
    setLoading(true)
    setResult(null)
    setValidateResult(null)
    setPollingStatus(null)
    try {
      const res = await fetch('/api/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct.id }),
      })
      const data = await res.json()
      if (data.success) setResult({ token: data.token, orderId: data.orderId })
    } finally {
      setLoading(false)
    }
  }

  const simulateESP = async () => {
    if (!result) return
    setValidating(true)
    setValidateResult(null)
    try {
      const res = await fetch('/api/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId, token: result.token }),
      })
      const data = await res.json()
      setValidateResult(data)
    } finally {
      setValidating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: S.bg, fontFamily: S.font }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 20px 8px' }}>
        <button onClick={() => router.push('/')} style={{ color: S.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>
            <span style={{ color: '#FFFFFF' }}>cup</span>
            <span style={{ background: 'linear-gradient(135deg, #E5A93C, #C8922A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>OS</span>
          </span>
          <p style={{ color: S.muted, fontSize: 10, marginTop: 2, letterSpacing: 2, textTransform: 'uppercase' }}>ESP Test Mode</p>
        </div>
        <div style={{ width: 34 }} />
      </header>

      <div style={{ flex: 1, padding: '16px 16px 0' }}>

        {/* Step 1 — Select product */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: '16px 18px', marginBottom: 16 }}>
          <p style={{ color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            1 · Select Product
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedProduct(p); setResult(null); setValidateResult(null) }}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 12,
                  background: selectedProduct?.id === p.id ? 'rgba(200,146,42,0.12)' : 'transparent',
                  border: `1px solid ${selectedProduct?.id === p.id ? 'rgba(200,146,42,0.5)' : 'rgba(200,146,42,0.1)'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <span style={{ color: S.cream, fontSize: 14 }}>☕ {p.name}</span>
                <span style={{ color: S.gold, fontSize: 13, fontWeight: 600 }}>&#x20B9;{Math.floor(p.price / 100)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Machine ID */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: '16px 18px', marginBottom: 16 }}>
          <p style={{ color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
            2 · Machine ID
          </p>
          <input
            value={machineId}
            onChange={e => setMachineId(e.target.value)}
            placeholder="e.g. INDORE-001"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`,
              borderRadius: 12, padding: '10px 14px', color: S.cream,
              fontSize: 14, fontFamily: S.font, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Step 3 — Generate Token */}
        <button
          onClick={generateToken}
          disabled={loading || !selectedProduct}
          style={{
            width: '100%', background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
            color: '#0D0A08', fontWeight: 700, fontSize: 16,
            padding: '14px 0', borderRadius: 16, border: 'none', cursor: 'pointer',
            opacity: loading ? 0.6 : 1, marginBottom: 16,
          }}
        >
          {loading ? 'Generating...' : '3 · Generate Test QR'}
        </button>

        {/* QR Result */}
        {result && (
          <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: '20px', marginBottom: 16, textAlign: 'center' }}>

            {/* Status badge */}
            <div style={{ marginBottom: 16 }}>
              {pollingStatus === 'REDEEMED' ? (
                <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: 1 }}>
                  ✓ REDEEMED — Coffee dispensed!
                </span>
              ) : (
                <span style={{ background: 'rgba(200,146,42,0.15)', color: S.gold, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: 1 }}>
                  ● WAITING — Point ESP scanner at QR
                </span>
              )}
            </div>

            {/* QR Code */}
            <div style={{ background: 'white', display: 'inline-block', padding: 16, borderRadius: 16, marginBottom: 12 }}>
              <QRCode value={result.token} size={180} />
            </div>

            {/* Token string */}
            <p style={{ color: S.gold, fontFamily: 'monospace', fontWeight: 700, fontSize: 18, letterSpacing: 3, marginBottom: 4 }}>
              {result.token}
            </p>
            <p style={{ color: S.muted, fontSize: 11, marginBottom: 20 }}>
              ESP endpoint: <span style={{ color: S.goldLight, fontFamily: 'monospace', fontSize: 10 }}>{API_BASE}/api/validate-token</span>
            </p>

            {/* Divider */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginBottom: 12 }}>
              <p style={{ color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>
                Or simulate ESP scan from browser
              </p>
              <button
                onClick={simulateESP}
                disabled={validating || pollingStatus === 'REDEEMED'}
                style={{
                  width: '100%', background: 'rgba(200,146,42,0.12)',
                  border: `1px solid rgba(200,146,42,0.4)`,
                  color: S.gold, fontWeight: 600, fontSize: 14,
                  padding: '12px 0', borderRadius: 12, cursor: 'pointer',
                  opacity: validating || pollingStatus === 'REDEEMED' ? 0.5 : 1,
                }}
              >
                {validating ? 'Validating...' : '⚡ Simulate ESP Scan'}
              </button>
            </div>

            {/* Validate result */}
            {validateResult && (
              <div style={{
                marginTop: 12, padding: '12px 16px', borderRadius: 12,
                background: validateResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${validateResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                <p style={{ color: validateResult.success ? '#22c55e' : '#ef4444', fontWeight: 700, fontSize: 14 }}>
                  {validateResult.success ? `✓ DISPENSE: ${validateResult.product}` : `✗ REJECTED: ${validateResult.reason}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ESP config reference */}
        <div style={{ background: 'rgba(200,146,42,0.05)', border: '1px dashed rgba(200,146,42,0.25)', borderRadius: 16, padding: '14px 16px', marginBottom: 24 }}>
          <p style={{ color: S.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>ESP32 Config</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Validate URL', value: `${API_BASE}/api/validate-token` },
              { label: 'Heartbeat URL', value: `${API_BASE}/api/heartbeat` },
              { label: 'Machine ID', value: machineId },
              { label: 'Method', value: 'POST · application/json' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: S.muted, fontSize: 11, flexShrink: 0 }}>{row.label}</span>
                <span style={{ color: S.goldLight, fontSize: 10, fontFamily: 'monospace', textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <p style={{ textAlign: 'center', fontSize: 10, padding: '8px 0 24px' }}>
        <span style={{ color: '#FFFFFF' }}>cup</span>
        <span style={{ color: 'rgba(196,185,154,0.2)' }}>OS · Dev Test Mode</span>
      </p>
    </div>
  )
}
