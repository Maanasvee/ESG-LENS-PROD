// ESG Lens — Next.js Edge Middleware
// Protects routes by Firebase token presence + role.

import { NextRequest, NextResponse } from 'next/server'

// Public routes (no auth required)
const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/firebase-messaging-sw.js']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for auth token in cookies (set by client after Firebase login)
  const authToken = request.cookies.get('auth-token')?.value

  if (!authToken) {
    // Redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // For admin routes, role check happens in the API (backend enforces 403)
  // The middleware just ensures the user is authenticated before hitting /admin
  // Full role enforcement is server-side in FastAPI
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|firebase-messaging-sw.js|login).*)',
  ],
}
