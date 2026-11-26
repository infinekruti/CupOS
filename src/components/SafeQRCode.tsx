'use client'

import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface SafeQRCodeProps {
  value: string
  size?: number
  showTokenText?: boolean
  tokenLabel?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * SafeQRCode
 * 
 * Bulletproof QR code component designed for mobile devices with Forced Dark Mode,
 * Night Mode, or browser inversion extensions (Chrome Android, Samsung Internet, Mi Browser).
 * 
 * Why this is immune to unscannable white-on-white issues:
 * 1. Renders as a raster PNG bitmap (<img>) generated via `qrcode.toDataURL`.
 *    Browser dark mode algorithms (Blink/WebKit) explicitly skip bitmap pixels.
 * 2. Strict CSS color-scheme isolation: `forced-color-adjust: none`, `color-scheme: light`.
 * 3. Includes an integrated 2-module quiet zone (white margin) baked into the raster image.
 * 4. Error correction level 'M' (15%) for optimal optical scan speed under glass / ambient glare.
 * 5. Displays the human-readable alphanumeric token code below the QR code with one-tap copy.
 */
export default function SafeQRCode({
  value,
  size = 220,
  showTokenText = false,
  tokenLabel,
  className,
  style,
}: SafeQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!value) {
      setDataUrl('')
      return
    }

    let isMounted = true

    // Render at 2x resolution (min 440px) for pin-sharp display on high-DPI / retina screens
    const renderWidth = Math.max(size * 2, 440)

    QRCode.toDataURL(value, {
      width: renderWidth,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (isMounted) {
          setDataUrl(url)
          setError(false)
        }
      })
      .catch((err) => {
        console.error('SafeQRCode generation error:', err)
        if (isMounted) setError(true)
      })

    return () => {
      isMounted = false
    }
  }, [value, size])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!value) return
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`qr-protected ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        colorScheme: 'light',
        forcedColorAdjust: 'none',
        isolation: 'isolate',
        ...style,
      }}
    >
      {/* White high-contrast bounding card with quiet zone */}
      <div
        style={{
          background: '#FFFFFF',
          backgroundColor: '#FFFFFF',
          padding: 14,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: size + 28,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          colorScheme: 'light',
          forcedColorAdjust: 'none',
          filter: 'none',
          WebkitFilter: 'none',
          isolation: 'isolate',
        }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR Code: ${value}`}
            style={{
              width: '100%',
              height: 'auto',
              maxWidth: size,
              maxHeight: size,
              display: 'block',
              imageRendering: 'pixelated',
              colorScheme: 'light',
              forcedColorAdjust: 'none',
              filter: 'none',
              WebkitFilter: 'none',
            }}
          />
        ) : error ? (
          <div
            style={{
              width: size,
              height: size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: 13,
              textAlign: 'center',
              padding: 12,
            }}
          >
            Failed to generate QR code.
          </div>
        ) : (
          <div
            style={{
              width: size,
              height: size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid rgba(0,0,0,0.1)',
                borderTopColor: '#C8922A',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          </div>
        )}
      </div>

      {/* Human-readable Alphanumeric Token Fallback */}
      {showTokenText && value && (
        <div
          onClick={handleCopy}
          title="Click to copy token code"
          style={{
            marginTop: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(200, 146, 42, 0.35)',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {tokenLabel && (
            <span style={{ fontSize: 11, color: '#C4B99A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {tokenLabel}:
            </span>
          )}
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 14,
              fontWeight: 700,
              color: '#F5F0E8',
              letterSpacing: 1,
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 11, color: copied ? '#4ade80' : '#C8922A', fontWeight: 600 }}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </span>
        </div>
      )}
    </div>
  )
}
