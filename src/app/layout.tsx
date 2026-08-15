import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'cupOS — Fresh Coffee, Made for You',
  description: 'Select your drink, pay via UPI, and collect your coffee at any cupOS machine. 100% cashless. Always fresh.',
  keywords: 'coffee, vending machine, UPI, cashless, cupOS',
  openGraph: {
    title: 'cupOS',
    description: 'Fresh coffee. Made for you.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-espresso">
        <div className="mobile-container">
          {children}
        </div>
      </body>
    </html>
  )
}
