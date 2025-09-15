import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Generate simple request id
function genReqId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const pathname = url.pathname

  // Prepare response
  const response = NextResponse.next()

  // Inject X-Request-Id for all API requests (readable by client and proxies)
  const rid = request.headers.get('x-request-id') || genReqId()
  response.headers.set('x-request-id', rid)

  // CSRF route CORS fix (for NextAuth)
  if (pathname === '/api/auth/csrf') {
    const origin = request.headers.get('origin') || request.headers.get('referer') || ''
    const allowed = [
      'https://www.urlchecker.dev',
      'https://urlchecker.dev',
      'https://www.autoads.dev',
      'https://autoads.dev',
      'http://localhost:3000'
    ]
    const allowOrigin = allowed.includes(origin) ? origin : allowed[0]
    response.headers.set('Access-Control-Allow-Origin', allowOrigin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token')
  }

  return response
}

export const config = {
  // Apply to API routes to inject x-request-id; and explicitly include csrf endpoint
  matcher: ['/api/:path*']
}

