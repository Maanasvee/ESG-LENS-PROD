'use client'
// ESG Lens — Auth Context Hook
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  User as FirebaseUser,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { api, User as ApiUser } from '../api'

interface AuthContextType {
  firebaseUser: FirebaseUser | null
  dbUser: ApiUser | null
  isAdmin: boolean
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshDbUser: () => Promise<ApiUser | null>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [dbUser, setDbUser] = useState<ApiUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchDbUser(): Promise<ApiUser | null> {
    try {
      const user = await api.getMe()
      setDbUser(user)
      return user
    } catch (e) {
      console.error('Failed to fetch DB user:', e)
      return null
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      if (fbUser) {
        await fetchDbUser()
      } else {
        setDbUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
    await fetchDbUser()
  }

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
    await fetchDbUser()
  }

  const signUpWithEmail = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password)
    await fetchDbUser()
  }

  const logout = async () => {
    await signOut(auth)
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
