import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Band Rang — Card Game',
  description: 'Online multiplayer Band Rang card game',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,   // prevent accidental zoom during card taps
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ touchAction: 'manipulation' }}>{children}</body>
    </html>
  )
}
