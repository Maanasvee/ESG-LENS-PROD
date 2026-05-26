// ESG Lens — Firebase Client SDK Initialization
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getMessaging, isSupported } from 'firebase/messaging'

const rawFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const isPlaceholderValue = (value?: string) =>
  !value || value.includes('dummy-') || value.includes('your-') || value === '12345678' || value === '1:1234:web:1234'

const isFirebaseConfigured = Object.values(rawFirebaseConfig).every(value => !isPlaceholderValue(value))

export const isMockAuth = !isFirebaseConfigured

const firebaseConfig = {
  apiKey: rawFirebaseConfig.apiKey || '',
  authDomain: rawFirebaseConfig.authDomain || '',
  projectId: rawFirebaseConfig.projectId || '',
  storageBucket: rawFirebaseConfig.storageBucket || '',
  messagingSenderId: rawFirebaseConfig.messagingSenderId || '',
  appId: rawFirebaseConfig.appId || '',
}

let app: any = null
let auth: any = null
let googleProvider: any = null

if (!isMockAuth) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    auth = getAuth(app)
    googleProvider = new GoogleAuthProvider()
  } catch (error) {
    console.error('Firebase client SDK initialization failed. Please verify your Firebase web config:', error)
    auth = null
    googleProvider = null
  }
}

export { auth, googleProvider }

// FCM messaging — only available in browser, not SSR
export const getMessagingInstance = async () => {
  if (isMockAuth || !app) return null
  const supported = await isSupported()
  if (!supported) return null
  try {
    return getMessaging(app)
  } catch (error) {
    return null
  }
}

export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''

export default app
