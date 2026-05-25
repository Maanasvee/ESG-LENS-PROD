// ESG Lens — Firebase Client SDK Initialization
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy-api-key",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-auth.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-storage.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "12345678",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234:web:1234",
}

export const isMockAuth =
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY.includes('your-') ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'dummy-api-key'

let app: any = null;
let auth: any = null;
let googleProvider: any = null;

if (!isMockAuth) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
    auth = getAuth(app)
    googleProvider = new GoogleAuthProvider()
  } catch (error) {
    console.warn("Firebase client SDK initialization failed, falling back to mock mode:", error)
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

export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ""

export default app
