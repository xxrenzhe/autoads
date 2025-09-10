import { auth } from './src/lib/auth/v5-config'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Admin routes protection
  if (pathname.startsWith('/admin')) {
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/?error=unauthorized', req.url))
    }
  }

  // Subscription-based features protection
  if (pathname.startsWith('/batchopen') || pathname.startsWith('/siterank')) {
    // Check if user has active subscription
    // This would be implemented with a database check
    // For now, we'll allow access
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/batchopen/:path*',
    '/siterank/:path*',
    '/api/admin/:path*',
  ],
}