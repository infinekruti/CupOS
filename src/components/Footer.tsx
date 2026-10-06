'use client'

import React from 'react'

export default function Footer() {
  return (
    <footer
      style={{
        padding: '24px 16px 28px',
        textAlign: 'center',
        fontFamily: "'Outfit', sans-serif",
        userSelect: 'none',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: 'rgba(196, 185, 154, 0.45)',
          letterSpacing: 0.3,
          fontWeight: 400,
          lineHeight: 1.5,
        }}
      >
        Developed by{' '}
        <span style={{ color: 'rgba(229, 169, 60, 0.75)', fontWeight: 500 }}>
          Infinekruti Innovations Pvt Ltd
        </span>{' '}
        for{' '}
        <span style={{ color: 'rgba(245, 240, 232, 0.8)', fontWeight: 600 }}>
          cupOS
        </span>
      </p>
    </footer>
  )
}
