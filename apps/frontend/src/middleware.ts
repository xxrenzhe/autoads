import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

async function verifyFirebaseToken(idToken: string) {
  if (!projectId) throw new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  return payload as any
}

export async function middleware(req: NextRequest) {
  const { method, nextUrl, headers } = req
  const pathname = nextUrl.pathname

  // 忽略静态资源与内部文件
  if (/^\/(?:_next|static|favicon\.ico|robots\.txt|sitemap(?:-.*)?\.xml)/.test(pathname)) {
    return NextResponse.next()
  }

  // 访问日志（stdout）：方法、路径、ip、ua
  const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip') || req.ip || 'unknown'
  const ua = headers.get('user-agent') || 'unknown'
  console.info(`[access] ${method} ${pathname} ip=${ip} ua=${ua}`)

  // 仅对 /console 做强校验
  if (pathname === '/console' || pathname.startsWith('/console/')) {
    try {
      // 支持从 Authorization 或 Cookie 获取 Firebase ID Token
      const authHeader = headers.get('authorization') || ''
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      const cookieToken = req.cookies.get('Firebase-Token')?.value
      const token = bearer || cookieToken
      if (!token) throw new Error('missing token')

      const payload = await verifyFirebaseToken(token)
      const role = (payload as any).role || (payload as any)["https://autoads.app/claims/role"]
      const email = (payload as any).email as string | undefined
      let ok = role === 'ADMIN'
      if (!ok && email && process.env.ADMIN_EMAILS) {
        const allow = process.env.ADMIN_EMAILS.split(',').map(s => s.trim().toLowerCase())
        ok = allow.includes(email.toLowerCase())
      }
      if (!ok) throw new Error('forbidden')
      return NextResponse.next()
    } catch (e) {
      const url = new URL('/auth/admin-signin', req.url)
      url.searchParams.set('callbackUrl', nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = { matcher: '/:path*' }
