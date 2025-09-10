/**
 * NextAuth动态配置
 * 根据运行环境自动适配AUTH_URL和其他配置
 */

/**
 * 获取当前应用的基础URL
 * 支持多种部署环境的自动检测
 */
export function getAuthUrl(): string {
  // 1. 优先使用环境变量中明确设置的AUTH_URL
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL
  }

  // 2. 根据NEXT_PUBLIC_DOMAIN环境变量构建URL
  if (process.env.NEXT_PUBLIC_DOMAIN) {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    return `${protocol}://${process.env.NEXT_PUBLIC_DOMAIN}`
  }

  // 3. 根据部署环境自动检测
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'production') {
    // 使用 www 子域名，因为 autoads.dev 可能会 301 跳转到 www.autoads.dev
    return 'https://www.autoads.dev'
  }
  
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'preview') {
    // 使用 www 子域名，因为 urlchecker.dev 会 301 跳转到 www.urlchecker.dev
    return 'https://www.urlchecker.dev'
  }
  
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'development') {
    return 'http://localhost:3000'
  }

  // 4. Vercel环境自动检测
  if (process.env.VERCEL_URL) {
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    return `${protocol}://${process.env.VERCEL_URL}`
  }

  // 5. 其他云平台环境变量检测
  if (process.env.RAILWAY_STATIC_URL) {
    return `https://${process.env.RAILWAY_STATIC_URL}`
  }

  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL
  }

  // 6. 开发环境默认值
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXTAUTH_URL || 'http://localhost:3000'
  }

  // 7. 生产环境回退值（应该避免到达这里）
  console.warn('⚠️ AUTH_URL could not be automatically determined. Using fallback.')
  return 'https://www.autoads.dev'
}

/**
 * 获取Google OAuth重定向URI
 */
export function getGoogleRedirectUri(): string {
  const baseUrl = getAuthUrl()
  return `${baseUrl}/api/auth/callback/google`
}

/**
 * 检查当前环境是否为生产环境
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * 检查当前环境是否应该使用安全cookies
 */
export function shouldUseSecureCookies(): boolean {
  const authUrl = getAuthUrl()
  return authUrl.startsWith('https://') || isProduction()
}

/**
 * 获取cookie名称前缀
 * 简化实现：容器环境和预发环境不使用特殊前缀
 */
export function getCookiePrefix(): string {
  // 在容器环境、预发环境和开发环境，不使用特殊前缀
  const env = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV
  const isContainer = process.env.KUBERNETES_SERVICE_HOST || 
                     process.env.HOSTNAME?.includes('autoads-');
  
  if (isContainer || env === 'preview' || process.env.NODE_ENV === 'development') {
    return ''
  }
  
  // 只有非容器的生产环境使用安全前缀
  return shouldUseSecureCookies() ? '__Secure-' : ''
}

/**
 * 获取CSRF cookie名称前缀
 * 简化实现，使用统一的cookie名称避免跨域问题
 */
export function getCSRFCookiePrefix(): string {
  // 简化实现：不使用特殊前缀，避免容器环境中的域名问题
  return '';
}

/**
 * 获取当前环境的cookie域名
 * 简化实现：只在非容器环境的正式生产环境设置域名
 */
export function getCookieDomain(): string | undefined {
  const env = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV
  
  // 简化逻辑：只在非容器的生产环境设置域名
  // 容器环境、预发环境和开发环境都不设置域名，使用浏览器默认
  if (env === 'production') {
    // 检查是否在容器环境中运行
    const isContainer = process.env.KUBERNETES_SERVICE_HOST || 
                       process.env.HOSTNAME?.includes('autoads-');
    
    if (!isContainer) {
      return '.autoads.dev'
    }
  }
  
  // 其他情况都不设置域名，让浏览器自动处理
  return undefined
}


/**
 * 打印当前认证配置信息（用于调试）
 */
export function logAuthConfig(): void {
  if (process.env.NODE_ENV === 'development' || process.env.AUTH_DEBUG === 'true') {
    console.log('🔐 NextAuth Configuration:')
    console.log(`   AUTH_URL: ${getAuthUrl()}`)
    console.log(`   Environment: ${process.env.NODE_ENV}`)
    console.log(`   Deployment: ${process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || 'unknown'}`)
    console.log(`   Domain: ${process.env.NEXT_PUBLIC_DOMAIN || 'auto-detected'}`)
    console.log(`   Secure Cookies: ${shouldUseSecureCookies()}`)
    console.log(`   Cookie Domain: ${getCookieDomain() || 'undefined'}`)
    console.log(`   CSRF Prefix: ${getCSRFCookiePrefix() || 'none'}`)
    console.log(`   Google Redirect: ${getGoogleRedirectUri()}`)
  }
}