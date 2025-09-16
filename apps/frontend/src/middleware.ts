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

  // Enforce: In production/preview, disable Next-side business writes for most API routes
  try {
    const method = request.method.toUpperCase()
    const isMutating = !(method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
    const allowWrites = (process.env.ALLOW_NEXT_WRITES || '').toLowerCase() === 'true'
    const env = (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || '').toLowerCase()
    const prodLike = env === 'production' || env === 'preview'
    if (prodLike && isMutating && pathname.startsWith('/api/')) {
      // Whitelist: NextAuth, gateway proxies, webhooks
      const allowedPrefixes = ['/api/auth', '/go', '/ops', '/api/stripe/webhook']
      const whitelisted = allowedPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (!whitelisted && !allowWrites) {
        return new NextResponse(
          JSON.stringify({ error: 'NOT_IMPLEMENTED', message: 'Next API writes are disabled on this deployment' }),
          { status: 501, headers: { 'content-type': 'application/json' } }
        )
      }
    }
  } catch {}

  return response
}

export const config = {
  // Apply to API routes to inject x-request-id; and explicitly include csrf endpoint
  matcher: ['/api/:path*']
}
