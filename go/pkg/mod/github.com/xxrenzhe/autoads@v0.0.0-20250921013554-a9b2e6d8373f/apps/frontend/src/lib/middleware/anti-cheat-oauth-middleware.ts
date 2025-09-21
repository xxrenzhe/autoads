import { NextRequest, NextResponse } from 'next/server'
import { antiCheatMiddleware } from '@/lib/security/anti-cheat-middleware'

/**
 * 防作弊中间件 - 用于 OAuth 回调
 */
export async function antiCheatOAuthMiddleware(request: NextRequest) {
  // 执行防作弊检查
  const antiCheatResult = await antiCheatMiddleware(request)
  
  if (!antiCheatResult.allowed) {
    // 如果检测到作弊，重定向到错误页面
    const errorUrl = new URL('/auth/error', request.url)
    errorUrl.searchParams.set('error', 'anti_cheat_detected')
    errorUrl.searchParams.set('reason', antiCheatResult.reason || 'unknown')
    
    return NextResponse.redirect(errorUrl)
  }
  
  // 如果允许通过，继续处理
  return NextResponse.next()
}