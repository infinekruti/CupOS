'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const S = {
  bg: '#070504',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(200,146,42,0.14)',
  gold: '#C8922A',
  goldLight: '#E5A93C',
  cream: '#F5F0E8',
  muted: '#C4B99A',
  font: "'Outfit', sans-serif"
}

export default function WalletPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState<number>(50000) // Default ₹500
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) {
        router.push('/menu')
        return
      }
      setUserId(data.session.user.id)
      fetchBalance(data.session.user.id)
    })
  }, [router])

  const fetchBalance = async (uid: string) => {
    const res = await fetch(`/api/wallet/balance?userId=${uid}`)
    const data = await res.json()
    setBalance(data.balance || 0)
    setLoading(false)
  }

  const handleTopup = async () => {
    if (!userId || processing) return
    setProcessing(true)

    try {
      // 1. Create order
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: topupAmount, userId })
      })
      const { orderId } = await res.json()
      if (!orderId) throw new Error('Order creation failed')

      // 2. Open Razorpay
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: topupAmount,
        currency: 'INR',
        name: 'CupOS Wallet',
        description: 'Add money to Wallet',
        order_id: orderId,
        theme: { color: S.gold },
        handler: async (response: any) => {
          // 3. Verify
          const verifyRes = await fetch('/api/wallet/verify-topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: topupAmount,
              userId
            })
          })
          const verifyData = await verifyRes.json()
          if (verifyData.success) {
            setBalance(verifyData.newBalance)
            setTopupAmount(50000)
            alert('Wallet Recharge Successful!')
          } else {
            alert('Payment verification failed.')
          }
          setProcessing(false)
        }
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', () => setProcessing(false))
      rzp.open()
    } catch (err) {
      alert('Error initiating payment')
      setProcessing(false)
    }
  }

  if (loading) return <div style={{ minHeight: '100dvh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.muted, fontFamily: S.font }}>Loading Wallet...</div>

  return (
    <div style={{ minHeight: '100dvh', background: S.bg, fontFamily: S.font, paddingBottom: 100 }}>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '44px 20px 20px' }}>
        <button onClick={() => router.push('/menu')} style={{ color: S.muted, background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 style={{ color: S.cream, fontSize: 18, fontWeight: 700, margin: 0 }}>My Wallet</h1>
        <div style={{ width: 34 }} />
      </header>

      <div style={{ padding: '0 20px' }}>
        {/* Balance Card */}
        <div style={{ background: `linear-gradient(135deg, ${S.card}, rgba(255,255,255,0.01))`, border: `1px solid ${S.border}`, borderRadius: 24, padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 30, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <span style={{ color: S.muted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 }}>Current Balance</span>
          <span style={{ color: S.goldLight, fontSize: 48, fontWeight: 800 }}>₹{Math.floor(balance / 100)}</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>1-Click Checkout Enabled</span>
        </div>

        {/* Topup Section */}
        <h2 style={{ color: S.cream, fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Add Money</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[100, 300, 500].map(amt => (
            <button
              key={amt}
              onClick={() => setTopupAmount(amt * 100)}
              style={{
                background: topupAmount === amt * 100 ? 'rgba(200,146,42,0.15)' : S.card,
                border: `1px solid ${topupAmount === amt * 100 ? S.gold : S.border}`,
                color: topupAmount === amt * 100 ? S.goldLight : S.cream,
                padding: '16px 0', borderRadius: 16, fontWeight: 600, fontSize: 16, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              +₹{amt}
            </button>
          ))}
        </div>

        <button
          onClick={handleTopup}
          disabled={processing || topupAmount <= 0}
          style={{
            width: '100%', background: `linear-gradient(135deg, ${S.goldLight}, ${S.gold})`,
            color: '#000', padding: '18px 0', borderRadius: 18, border: 'none',
            fontWeight: 700, fontSize: 17, cursor: 'pointer', opacity: processing ? 0.7 : 1,
            boxShadow: '0 8px 30px rgba(200,146,42,0.3)',
          }}
        >
          {processing ? 'Processing...' : `Proceed to Pay ₹${topupAmount / 100}`}
        </button>

      </div>
    </div>
  )
}
