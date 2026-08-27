'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const S = {
  bg: '#0D0A08',
  card: 'rgba(255,255,255,0.05)',
  border: 'rgba(200,146,42,0.2)',
  borderFocus: 'rgba(200,146,42,0.6)',
  gold: '#C8922A',
  goldLight: '#E5A93C',
  cream: '#F5F0E8',
  muted: '#C4B99A',
  subtle: 'rgba(196,185,154,0.4)',
  font: "'Outfit', sans-serif",
}

type AuthStep = 'main'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<AuthStep>('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Google OAuth ──────────────────────────────
  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/menu` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  // ── Guest ─────────────────────────────────────
  const handleGuest = () => {
    sessionStorage.setItem('cupos_guest', 'true')
    router.push('/menu')
  }

  return (
    <div style={{
      minHeight: '100dvh', background: S.bg, fontFamily: S.font,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 20px',
    }}>

      {/* Background orbs */}
      <div style={{
        position: 'fixed', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,146,42,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>☕</div>
        <h1 style={{
          fontSize: 38, fontWeight: 800, letterSpacing: -1, lineHeight: 1,
        }}>
          <span style={{ color: '#FFFFFF' }}>cup</span>
          <span style={{
            background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>OS</span>
        </h1>
        <p style={{ color: S.muted, fontSize: 14, marginTop: 8 }}>
          Premium coffee, one tap away
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 390,
        background: S.card, border: `1px solid ${S.border}`,
        borderRadius: 28, padding: '32px 24px',
        backdropFilter: 'blur(20px)',
      }}>

        {/* ── MAIN STEP ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: S.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 4 }}>
              Sign in to continue
            </p>

            {/* Google */}
            <button
              id="google-login-btn"
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '15px 20px', borderRadius: 16,
                background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                fontFamily: S.font, fontWeight: 700, fontSize: 16, color: '#0D0A08',
                boxShadow: '0 8px 32px rgba(200,146,42,0.4)',
                opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#0D0A08" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#0D0A08" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#0D0A08" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#0D0A08" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            {/* Guest */}
            <button
              id="guest-btn"
              onClick={handleGuest}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: S.subtle, fontSize: 13, fontFamily: S.font,
                padding: '8px 0', textDecoration: 'underline', textUnderlineOffset: 3,
              }}
            >
              Continue as Guest
            </button>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: 13, textAlign: 'center' }}>{error}</p>
            )}
          </div>


      </div>

      <p style={{ color: 'rgba(196,185,154,0.2)', fontSize: 10, marginTop: 32, textAlign: 'center' }}>
        By continuing, you agree to cupOS Terms & Privacy Policy
      </p>
    </div>
  )
}
