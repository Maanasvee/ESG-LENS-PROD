'use client'
// ESG Lens — Auth Context (Production)
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  signInWithRedirect,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getRedirectResult,
} from 'firebase/auth'
import { auth, googleProvider, isMockAuth } from '../firebase'
import { api } from '../api'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AppUser {
  id: number | string
  email: string
  name: string | null
  role: 'user' | 'admin'
  sector_prefs: string[]
  jurisdiction_prefs: string[]
  email_digest_opt_in: boolean
}

interface AuthContextType {
  firebaseUser: any | null
  dbUser: AppUser | null
  isAdmin: boolean
  loading: boolean
  signInWithGoogle: () => Promise<'completed' | 'redirected'>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshDbUser: () => Promise<AppUser | null>
}

// ── Cookie helpers ──────────────────────────────────────────────────────────

function setSessionCookie(token: string) {
  const maxAge = 60 * 60 * 24 * 7 // 7 days
  document.cookie = `auth-token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`
}

function clearSessionCookie() {
  document.cookie = 'auth-token=; path=/; max-age=0'
}

// ── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function createMockSessionFromToken(uid: string) {
  const role = uid.includes('admin') ? 'admin' as const : 'user' as const
  const email = uid === 'mock-admin'
    ? 'admin@bevolve.ai'
    : `${role}@local.test`

  return { uid, email, role }
}

// ── Mock user builder ───────────────────────────────────────────────────────

function buildMockDbUser(uid: string, email: string, role: 'admin' | 'user'): AppUser {
  const parts = email.split('@')[0].split(/[._+\-]/)
  const name = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
  return {
    id: uid,
    email,
    name: name || (role === 'admin' ? 'Editorial Manager' : 'Policy Analyst'),
    role,
    sector_prefs: ['Energy', 'Finance', 'Manufacturing'],
    jurisdiction_prefs: ['India', 'Global', 'EU'],
    email_digest_opt_in: true,
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null)
  const [dbUser, setDbUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchDbUser(token?: string): Promise<AppUser | null> {
    try {
      const user = await api.getMe(token)
      const appUser: AppUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sector_prefs: (user as any).sector_prefs || [],
        jurisdiction_prefs: (user as any).jurisdiction_prefs || [],
        email_digest_opt_in: (user as any).email_digest_opt_in || false,
      }
      setDbUser(appUser)
      return appUser
    } catch (e) {
      console.error('Failed to fetch user profile:', e)
      return null
    }
  }

  async function handleAuthenticatedUser(fbUser: any | null, explicitToken?: string) {
    setFirebaseUser(fbUser)
    if (fbUser) {
      const token = explicitToken ?? (await fbUser.getIdToken())
      setSessionCookie(token)
      await fetchDbUser(token)
    } else {
      setDbUser(null)
      clearSessionCookie()
    }
    setLoading(false)
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isMockAuth) {
      // Restore session from localStorage, or recover it from the auth cookie.
      const saved = typeof window !== 'undefined' ? localStorage.getItem('esg_session') : null
      const cookieToken = getCookieValue('auth-token')
      let restoredSession: { uid: string; email: string; role: 'admin' | 'user' } | null = null

      if (saved) {
        try {
          const u = JSON.parse(saved)
          if (u?.uid && u?.email && u?.role) {
            restoredSession = u
          }
        } catch {
          restoredSession = null
        }
      }

      if (!restoredSession && cookieToken) {
        restoredSession = createMockSessionFromToken(cookieToken)
        if (typeof window !== 'undefined') {
          localStorage.setItem('esg_session', JSON.stringify(restoredSession))
        }
      }

      if (restoredSession) {
        setFirebaseUser(restoredSession)
        setDbUser(buildMockDbUser(restoredSession.uid, restoredSession.email, restoredSession.role))
        setSessionCookie(restoredSession.uid)
      } else {
        clearSessionCookie()
      }
      setLoading(false)
      return
    }

    let unsubscribe: (() => void) | undefined

    const initAuth = async () => {
      try {
        const redirectResult = await getRedirectResult(auth)
        if (redirectResult?.user) {
          const token = await redirectResult.user.getIdToken()
          await handleAuthenticatedUser(redirectResult.user, token)
          return
        }
      } catch (error) {
        console.warn('Failed to process Firebase redirect result:', error)
      }

      unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        void handleAuthenticatedUser(fbUser)
      })
    }

    void initAuth()

    return () => {
      unsubscribe?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signInWithGoogle = async (): Promise<'completed' | 'redirected'> => {
    if (isMockAuth) {
      const uid = 'mock-admin'
      const u = { uid, email: 'admin@bevolve.ai', role: 'admin' as const }
      localStorage.setItem('esg_session', JSON.stringify(u))
      setSessionCookie(uid)
      setFirebaseUser(u)
      setDbUser(buildMockDbUser(uid, u.email, u.role))
      return 'completed'
    }

    if (!auth || !googleProvider) {
      throw new Error('Google sign-in is not configured. Add your Firebase web credentials to frontend/.env.local and restart the app.')
    }

    const redirectResult = await getRedirectResult(auth)
    if (redirectResult?.user) {
      setFirebaseUser(redirectResult.user)
      const token = await redirectResult.user.getIdToken()
      setSessionCookie(token)
      await fetchDbUser(token)
      return 'completed'
    }

    await signInWithRedirect(auth, googleProvider)
    return 'redirected'
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (isMockAuth) {
      const emailLower = email.toLowerCase()
      const isBevolve = emailLower.endsWith('@bevolve.ai')
      const isAdminUser = emailLower.includes('admin') || isBevolve
      const role = isAdminUser ? 'admin' as const : 'user' as const
      const uid = `mock-${role}:${email}`
      const u = { uid, email, role }
      localStorage.setItem('esg_session', JSON.stringify(u))
      setSessionCookie(uid)
      setFirebaseUser(u)
      setDbUser(buildMockDbUser(uid, email, role))
      return
    }
    const result = await signInWithEmailAndPassword(auth, email, password)
    const token = await result.user.getIdToken()
    setSessionCookie(token)
    await fetchDbUser(token)
  }

  const signUpWithEmail = async (email: string, password: string) => {
    if (isMockAuth) {
      await signInWithEmail(email, password)
      return
    }
    const result = await createUserWithEmailAndPassword(auth, email, password)
    const token = await result.user.getIdToken()
    setSessionCookie(token)
    await fetchDbUser(token)
  }

  const logout = async () => {
    if (isMockAuth) {
      localStorage.removeItem('esg_session')
      clearSessionCookie()
      setFirebaseUser(null)
      setDbUser(null)
      return
    }
    await signOut(auth)
    clearSessionCookie()
    setDbUser(null)
  }

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      dbUser,
      isAdmin: dbUser?.role === 'admin',
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      refreshDbUser: fetchDbUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
