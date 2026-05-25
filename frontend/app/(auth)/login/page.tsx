'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  async function handleGoogle() {
    setLoading(true); setError('')
    try {
      await signInWithGoogle()
      router.push(redirect)
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed')
    } finally { setLoading(false) }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await signInWithEmail(email, password)
      router.push(redirect)
    } catch (e: any) {
      setError(e.message || 'Sign-in failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--color-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-4)',
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(15, 76, 58, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(34, 197, 94, 0.05) 0%, transparent 50%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)',
            background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: 'var(--radius-lg)', padding: '8px 16px', marginBottom: 'var(--space-4)',
          }}>
            <div style={{
              width: 32, height: 32, background: 'linear-gradient(135deg, #0F4C3A, #22C55E)',
              borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🌿</div>
            <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, #22C55E, #4ADE80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ESG Lens
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 8, letterSpacing: -0.5 }}>
            Policy Intelligence
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Sign in to access verified ESG regulatory intelligence
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          {/* Google SSO */}
          <button className="btn btn-secondary" id="google-signin-btn" onClick={handleGoogle} disabled={loading}
            style={{ width: '100%', height: 48, fontSize: 15, gap: 12, marginBottom: 'var(--space-5)' }}>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-4) 0', color: 'var(--color-text-muted)', fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            or
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@company.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error && (
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-critical-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-critical)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button id="email-signin-btn" type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
              {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Powered by{' '}
          <a href="https://bevolve.ai" target="_blank" style={{ color: 'var(--color-accent)' }}>Bevolve.ai</a>
        </p>
      </div>
    </div>
  )
}
