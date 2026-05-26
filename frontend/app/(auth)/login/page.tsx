'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { isMockAuth } from '@/lib/firebase'

function LoginForm() {
  const { firebaseUser, signInWithGoogle, signInWithEmail } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirect = searchParams.get('redirect') || '/tracker'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function goAfterLogin() {
    await new Promise(r => setTimeout(r, 80))
    router.push(redirect)
  }

  useEffect(() => {
    if (firebaseUser) {
      void goAfterLogin()
    }
  }, [firebaseUser])

  async function handleGoogle() {
    setLoading(true)
    setError('')
    try {
      const outcome = await signInWithGoogle()
      if (outcome === 'redirected') {
        setLoading(false)
        return
      }
      await goAfterLogin()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signInWithEmail(email, password)
      await goAfterLogin()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Left Brand Panel */}
      <div className="login-brand-panel">
        <div>
          <div className="login-brand-logo">
            <div className="login-brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div className="login-brand-name">ESG Lens</div>
              <div className="login-brand-tagline">by Bevolve.ai</div>
            </div>
          </div>
        </div>

        <div className="login-brand-headline">
          <h2>Regulatory Intelligence<br />for Sustainability Leaders</h2>
          <p>
            Monitor 30+ global and India-specific ESG regulatory sources.
            AI-classified and editorially verified — so your team always acts on accurate intelligence.
          </p>

          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              'Real-time policy monitoring across SEBI, MoEFCC, EU Taxonomy & more',
              'Expert-reviewed AI policy classification for reliable results',
              'Personalised alerts by sector, jurisdiction, and impact level',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.5' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="login-brand-footer">
          © 2025 Bevolve.ai. All rights reserved.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-form-panel">
        <div className="login-form-inner">
          <h1 className="login-form-title">Sign in to your workspace</h1>
          <p className="login-form-sub">Access your ESG regulatory intelligence dashboard</p>

          {error && <div className="login-error">{error}</div>}

          {!isMockAuth ? (
            <button
              type="button"
              className="login-btn-google"
              id="google-signin-btn"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {loading ? 'Signing in…' : 'Continue with Google'}
            </button>
          ) : (
            <div style={{ margin: '12px 0', color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
              Google login is not configured yet. Add your Firebase web credentials to <strong>frontend/.env.local</strong> and restart the app to enable Google sign-in.
            </div>
          )}

          <div className="login-divider">or continue with email</div>

          <form onSubmit={handleEmail}>
            <div className="login-field">
              <label htmlFor="login-email">Work email address</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="login-btn-primary"
              id="email-signin-btn"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="login-footer-note">
            By signing in, you agree to Bevolve.ai's{' '}
            <a href="https://bevolve.ai" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            {' '}and{' '}
            <a href="https://bevolve.ai" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="login-page" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
