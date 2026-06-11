import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Band Rang — Card Game',
  description: 'Online multiplayer Band Rang card game',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
