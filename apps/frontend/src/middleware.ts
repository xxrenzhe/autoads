import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { method, nextUrl, headers } = req
  const pathname = nextUrl.pathname

  // 忽略静态资源与内部文件
  if (/^\/(?:_next|static|favicon\.ico|robots\.txt|sitemap\.xml)/.test(pathname)) {
    return NextResponse.next()
  }

  // 访问日志（stdout）：方法、路径、ip、ua
  const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip') || req.ip || 'unknown'
  const ua = headers.get('user-agent') || 'unknown'
  console.info(`[access] ${method} ${pathname} ip=${ip} ua=${ua}`)

  return NextResponse.next()
}

export const config = {
  // 针对所有路径生效（静态资源上面已忽略）
  matcher: '/:path*',
}

