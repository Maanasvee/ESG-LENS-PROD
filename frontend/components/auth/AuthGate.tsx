'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { isMockAuth } from '@/lib/firebase'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, firebaseUser } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    const hasMockSession = isMockAuth &&
      typeof window !== 'undefined' &&
      !!localStorage.getItem('esg_session')
    if (!firebaseUser && !hasMockSession) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [loading, firebaseUser, pathname, router])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-subtle)',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          width: 28,
          height: 28,
          border: '2.5px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading workspace…</span>
      </div>
    )
  }

  const hasMockSession = isMockAuth &&
    typeof window !== 'undefined' &&
    !!localStorage.getItem('esg_session')

  if (!firebaseUser && !hasMockSession) return null

  return <>{children}</>
}
