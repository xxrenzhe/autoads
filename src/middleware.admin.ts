import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'

/**
 * 管理员路由保护中间件
 */
export async function adminMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 检查是否是管理员路由
  if (pathname.startsWith('/admin-dashboard') || pathname.startsWith('/api/admin')) {
    try {
      // 获取当前会话
      const session = await auth()
      
      // 如果没有会话或用户不是管理员，重定向到管理员登录页
      if (!session?.user || !['ADMIN'].includes(session.user.role)) {
        const signInUrl = new URL('/auth/admin-signin', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        
        return NextResponse.redirect(signInUrl)
      }
      
      // 管理员用户，允许访问
      return NextResponse.next()
      
    } catch (error) {
      console.error('Admin middleware error:', error)
      
      // 发生错误时重定向到管理员登录页
      const signInUrl = new URL('/auth/admin-signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      signInUrl.searchParams.set('error', 'AuthError')
      
      return NextResponse.redirect(signInUrl)
    }
  }

  // 非管理员路由，继续处理
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin-dashboard/:path*',
    '/api/admin/:path*'
  ]
}