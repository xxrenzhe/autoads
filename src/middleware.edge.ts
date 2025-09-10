import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

export function middleware(request: NextRequest) {
  // Get the user's region from the request headers
  const region = request.headers.get('x-vercel-ip-country') || 
                 request.headers.get('cf-ipcountry') || 
                 'US'
  
  // Create a response
  const response = NextResponse.next()
  
  // Add region header for downstream use
  response.headers.set('x-user-region', region)
  
  // Set edge-specific headers
  response.headers.set('x-edge-runtime', 'true')
  
  // Region-specific optimizations
  if (region === 'CN') {
    // Chinese users get different optimization
    response.headers.set('x-content-region', 'china')
  } else if (['US', 'CA', 'GB', 'AU'].includes(region)) {
    // English-speaking countries
    response.headers.set('x-content-region', 'en')
  } else {
    // Other regions
    response.headers.set('x-content-region', 'global')
  }
  
  return response
}

export const config = {
  matcher: [
    // Apply to all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}