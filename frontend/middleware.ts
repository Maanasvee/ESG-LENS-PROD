import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/firebase-messaging-sw.js']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const authToken = request.cookies.get('auth-token')?.value

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    if (pathname.startsWith('/login') && authToken) {
      return NextResponse.redirect(new URL('/tracker', request.url))
    }
    return NextResponse.next()
  }

  if (!authToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|firebase-messaging-sw.js).*)'],
}
