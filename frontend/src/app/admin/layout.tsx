'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: '📊 Dashboard' },
  { href: '/admin/users',     label: '👥 Users' },
  { href: '/admin/rooms',     label: '🏠 Rooms' },
  { href: '/admin/history',   label: '🃏 Game History' },
  { href: '/admin/health',    label: '🩺 System Health' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Redirect to login if no admin token
    const token = localStorage.getItem('admin_token')
    if (!token && pathname !== '/admin/login') {
      router.push('/admin/login')
    }
  }, [pathname, router])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    router.push('/admin/login')
  }

  if (pathname === '/admin/login') return <>{children}</>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#1e293b', color: '#f1f5f9',
        display: 'flex', flexDirection: 'column', padding: '24px 0',
      }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #334155' }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎴 Band Rang</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Admin Panel</p>
        </div>
        <nav style={{ flex: 1, padding: '16px 0' }}>
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'block', padding: '10px 20px', textDecoration: 'none',
              color: pathname === item.href ? '#38bdf8' : '#cbd5e1',
              background: pathname === item.href ? '#0f172a' : 'transparent',
              borderLeft: pathname === item.href ? '3px solid #38bdf8' : '3px solid transparent',
              fontSize: 14,
            }}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid #334155' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '8px', background: '#dc2626',
            color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, background: '#f8fafc', padding: 32, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
