'use client'

import React from 'react'

type AboutModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#14100D',
          border: '1px solid rgba(200, 146, 42, 0.3)',
          borderRadius: 24,
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(200,146,42,0.15)',
          overflow: 'hidden',
          fontFamily: "'Outfit', sans-serif",
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'linear-gradient(180deg, rgba(200,146,42,0.08) 0%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(200,146,42,0.2), rgba(229,169,60,0.1))',
                border: '1px solid rgba(200,146,42,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              ☕
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#F5F0E8', lineHeight: 1.2 }}>
                About cupOS
              </h2>
              <span style={{ fontSize: 12, color: '#C4B99A' }}>
                Smart Automated Coffee
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#C4B99A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Mission & Hygiene banner */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 16,
              padding: '14px 16px',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: '#F5F0E8', lineHeight: 1.5 }}>
              <strong style={{ color: '#E5A93C' }}>cupOS</strong> is a next-generation automated beverage station delivering fresh, premium barista-grade coffee with zero human touch. 100% cashless, instant, and hygienically brewed.
            </p>
          </div>

          {/* FSSAI License Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(200,146,42,0.06) 100%)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 16,
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: '#22c55e',
                    color: '#0D0A08',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    padding: '2px 8px',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  FSSAI Certified
                </span>
                <span style={{ fontSize: 11, color: '#86efac', fontWeight: 600 }}>
                  Food Safety Standard
                </span>
              </div>
              <span style={{ fontSize: 14 }}>🛡️</span>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                FSSAI License / Registration No.
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F0E8', letterSpacing: 1 }}>
                {process.env.NEXT_PUBLIC_FSSAI_LICENSE || '21426850009382'}
              </div>
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 12, fontSize: 11, color: '#C4B99A' }}>
              <span>✓ 100% Food-Grade</span>
              <span>✓ Automated Thermal Brew</span>
              <span>✓ Sealed Ingredients</span>
            </div>
          </div>

          {/* Contact Details Card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(200,146,42,0.15)',
              borderRadius: 16,
              padding: '16px',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#E5A93C', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Customer Support & Contact
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Phone / Helpline */}
              <a
                href="tel:+917869415275"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  color: '#F5F0E8',
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(200,146,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  📞
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#C4B99A' }}>Helpline / Support</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>+91 78694 15275</div>
                </div>
              </a>

              {/* WhatsApp Support */}
              <a
                href="https://wa.me/917869415275?text=Hello%20cupOS%20Support"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  color: '#F5F0E8',
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(34,197,94,0.06)',
                  border: '1px solid rgba(34,197,94,0.15)',
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  💬
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#86efac' }}>WhatsApp Chat</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F0E8' }}>Chat with Support</div>
                </div>
              </a>

              {/* Email */}
              <a
                href="mailto:support@cupos.in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                  color: '#F5F0E8',
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(200,146,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  ✉️
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#C4B99A' }}>Email Support</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>support@cupos.in</div>
                </div>
              </a>

              {/* Operating Location */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: '#F5F0E8',
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(200,146,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  📍
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#C4B99A' }}>Operating Location</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Indore, Madhya Pradesh, India</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #E5A93C, #C8922A)',
              border: 'none',
              color: '#0D0A08',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
