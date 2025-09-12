import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Handle CSRF cookie issues in container environments
  if (request.nextUrl.pathname === '/api/auth/csrf') {
    const response = NextResponse.next()
    
    // Ensure CSRF cookies work across domain redirects
    const origin = request.headers.get('origin') || request.headers.get('referer')
    
    if (origin && (origin.includes('urlchecker.dev') || origin.includes('autoads.dev'))) {
      // Add CORS headers for auth routes
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token')
    }
    
    return response
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/auth/csrf',
}
