import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
// 延迟使用 prisma：import 保留，但仅在确有 DATABASE_URL 时附加到 NextAuth 适配器，
// 避免无数据库环境下模块初始化失败或无意义的引擎加载。
import { prisma } from '@/lib/db'
import { NextRequest } from 'next/server'
import { 
  getAuthUrl, 
  shouldUseSecureCookies, 
  getCookiePrefix, 
  getCSRFCookiePrefix,
  getCookieDomain,
  logAuthConfig 
} from './auth-config'
import { createInternalJWT, ensureRequestId } from '@/lib/security/internal-jwt'

// 环境变量桥接：避免重复配置 NEXTAUTH_* 与 AUTH_*
// - 若仅设置了 AUTH_URL/AUTH_SECRET，则在运行时补齐 NEXTAUTH_URL/NEXTAUTH_SECRET
if (!process.env.NEXTAUTH_URL && process.env.AUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL
}
if (!process.env.NEXTAUTH_SECRET && process.env.AUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET
}

// 简单设备指纹生成
function generateSimpleDeviceFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || ''
  const acceptLanguage = request.headers.get('accept-language') || ''
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  
  // 简单的hash算法
  const data = `${userAgent}|${acceptLanguage}|${acceptEncoding}`
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  
  return Math.abs(hash).toString(36)
}

// 在启动时打印配置信息（仅开发/调试环境）
logAuthConfig()

// 处理新用户的订阅创建（支持邀请码）
export async function handleNewUserSubscription(userId: string, userEmail: string, invitationCode?: string) {
  try {
    // KISS：Next 不再直接写入业务库（订阅/Token）。
    // 仅尝试：
    // - 应用邀请码（若前端服务仍保留）；
    // - 通过内部JWT访问 Go 后端的只读端点，触发后端侧的用户态初始化（若有）。

    if (invitationCode) {
      try {
        const { InvitationService } = await import('@/lib/services/invitation-service')
        const invitationResult = await InvitationService.acceptInvitation(invitationCode, userId)
        if (invitationResult.success) {
          console.log(`[auth] Invitation applied for user ${userEmail}`)
        } else {
          console.log(`[auth] Invitation apply failed: ${invitationResult.error}`)
        }
      } catch (e) {
        console.warn('[auth] Invitation handler unavailable or failed:', e)
      }
    }

    // 尝试调用 Go 后端只读端点以预热（不强依赖）
    const token = createInternalJWT({ sub: userId })
    if (token) {
      const headers = new Headers({ 'Authorization': `Bearer ${token}` })
      ensureRequestId(headers as any)
      // 触发订阅只读查询
      fetch('/api/go/api/v1/user/subscription/current', { headers }).catch(() => {})
      // 触发 Token 余额只读查询
      fetch('/api/go/api/v1/tokens/balance', { headers }).catch(() => {})
    }
  } catch (error) {
    console.error('[auth] handleNewUserSubscription failed:', error)
  }
}

// 按需构建 Prisma 适配器：缺少数据库环境时不附加适配器（JWT session 仍可工作）
function buildPrismaAdapterIfAvailable() {
  if (!process.env.DATABASE_URL) {
    console.warn('[auth] Prisma adapter disabled: missing DATABASE_URL')
    return undefined
  }
  const base = PrismaAdapter(prisma)
  return {
    ...base,
    async createUser(data: any) {
      // 按 schema 正常写入头像与名称
      const { emailVerified, image, name, ...userData } = data
      const user = await prisma.user.create({
        data: {
          ...userData,
          emailVerified: emailVerified ? true : false,
          avatar: image || null,
          name: name || null,
        }
      })
      try {
        const { InvitationService } = await import('@/lib/services/invitation-service')
        const invitationResult = await InvitationService.createInvitation(user.id)
        if (invitationResult.success) {
          console.log(`Auto-generated invitation code for new user: ${user.email} - ${invitationResult.invitationCode}`)
        } else {
          console.error('Failed to auto-generate invitation code:', invitationResult.error)
        }
      } catch (error) {
        console.error('Error auto-generating invitation code:', error)
      }
      return {
        id: user.id,
        email: user.email,
        name: (user as any).name || undefined,
        emailVerified: user.emailVerified ? new Date() : null,
        image: user.avatar || undefined,
        role: user.role,
        status: user.status,
        isNewUser: true
      }
    }
  }
}

// 惰性初始化以避免构建阶段评估 NextAuth（缺少 OAuth 环境变量会报错）
let __nextAuth: any
function getNextAuth() {
  if (!__nextAuth) {
    const providers: any[] = []
    if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
      providers.push(Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        authorization: {
          params: {
            prompt: 'select_account',
            access_type: 'offline',
            response_type: 'code',
            scope: 'openid email profile'
          }
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            emailVerified: profile.email_verified ? true : false,
            role: 'USER',
            status: 'ACTIVE'
          }
        }
      }))
    } else {
      console.warn('[auth] Google provider disabled: missing AUTH_GOOGLE_ID/SECRET')
    }

    const adapter = buildPrismaAdapterIfAvailable()
    // 兼容 NEXTAUTH_SECRET 与 AUTH_SECRET，两者任一均可；生产环境必须提供
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV !== 'production' ? 'dev-secret-autoads' : undefined)
    if (!secret && process.env.NODE_ENV === 'production') {
      console.error('[auth] Missing AUTH_SECRET/NEXTAUTH_SECRET in production. JWT sessions will fail.')
    }

    const na: any = NextAuth({
      ...(adapter ? { adapter } : {}),
      secret,
      debug: process.env.NODE_ENV === 'development' || process.env.AUTH_DEBUG === 'true',
  // Enhanced logging for debugging
  logger: {
    error(code: string, metadata?: any) {
      console.error(`[auth][error] ${code}:`, metadata)
      if (code === 'CSRF_TOKEN_MISMATCH' || code === 'MISSING_CSRF') {
        console.error('[auth][csrf] CSRF Error Details:', {
          timestamp: new Date().toISOString(),
          userAgent: metadata?.request?.headers?.['user-agent'],
          origin: metadata?.request?.headers?.origin,
          referer: metadata?.request?.headers?.referer,
          cookies: metadata?.request?.headers?.cookie ? 'present' : 'missing',
          method: metadata?.request?.method,
          url: metadata?.request?.url,
        })
      }
      if (code === 'UNKNOWN_ACTION') {
        console.error('[auth][action] Unknown Action Details:', {
          timestamp: new Date().toISOString(),
          action: metadata?.action,
          method: metadata?.method,
          url: metadata?.url,
          availableActions: ['signin', 'signout', 'callback', 'csrf', 'providers', 'session'],
        })
      }
    },
    warn(code: string) {
      console.warn(`[auth][warn] ${code}`)
    },
    debug(code: string, metadata?: any) {
      if (process.env.AUTH_DEBUG === 'true') {
        console.log(`[auth][debug] ${code}:`, metadata)
      }
    },
  },
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (optimized)
    updateAge: 24 * 60 * 60, // Update session every 24 hours for auto-renewal
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token
        token.userId = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.emailVerified = user.emailVerified ? true : false
        token.role = user.role
        token.status = user.status
        token.internalJwt = createInternalJWT({ sub: user.id })
      }
      return token
    },
    async session({ session, token }) {
      const typedSession = session as any
      typedSession.accessToken = token.accessToken as string
      typedSession.userId = token.userId as string
      typedSession.internalJwt = token.internalJwt as string
      
      if (!typedSession.user) {
        typedSession.user = {}
      }
      
      if (token.userId && token.email) {
        const user = await prisma.user.findUnique({
          where: { id: token.userId },
          select: {
            id: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
            tokenBalance: true,
            lastLoginAt: true,
            emailVerified: true,
          }
        })
        
        if (user) {
          const updateData: any = { lastLoginAt: new Date() }
          let needsUpdate = false
          
          if (token.picture && (user as any).avatar !== token.picture) {
            updateData.avatar = token.picture
            needsUpdate = true
          }
          
          if (token.name) {
            try {
              await prisma.user.update({ where: { id: user.id }, data: { name: token.name } })
            } catch (e: any) {
              if (process.env.AUTH_DEBUG === 'true') console.warn('[auth] skip updating name:', e?.code || e)
            }
          }
          
          if (needsUpdate) {
            await prisma.user.update({
              where: { id: user.id },
              data: updateData
            })
          } else if (!user.lastLoginAt || new Date().getTime() - user.lastLoginAt.getTime() > 300000) {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() }
            })
          }
          
          typedSession.user = {
            ...session.user,
            id: user.id,
            name: (user as any).name || (token as any).name || (user.email ? user.email.split('@')[0] : undefined),
            email: user.email,
            image: (user as any).avatar || undefined,
            role: user.role,
            status: user.status,
            isActive: user.status === 'ACTIVE',
            emailVerified: user.emailVerified,
          }
          
          return typedSession
        }

        try {
          const internal = createInternalJWT({ sub: token.userId as string })
          if (internal) {
            const headers = new Headers({ 'Authorization': `Bearer ${internal}` })
            ensureRequestId(headers as any)
            const [subResp, balResp, statsResp] = await Promise.all([
              fetch('/api/go/api/v1/user/subscription/current', { headers }),
              fetch('/api/go/api/v1/tokens/balance', { headers }),
              fetch('/api/go/api/v1/tokens/stats', { headers })
            ])
            const subJson: any = await subResp.json().catch(() => null)
            const balJson: any = await balResp.json().catch(() => null)
            const statsJson: any = await statsResp.json().catch(() => null)
            const planName = subJson?.data?.plan_name || subJson?.data?.plan || undefined
            const goBalance = typeof balJson?.balance === 'number' ? balJson.balance : undefined
            if (planName) (typedSession.user as any).planName = planName
            if (typeof goBalance === 'number') (typedSession.user as any).tokenBalance = goBalance
            if (statsJson && typeof statsJson === 'object') (typedSession.user as any).tokenStats = statsJson
          }
        } catch (e) {
          if (process.env.AUTH_DEBUG === 'true') console.warn('[auth] merge Go read-only state failed', e)
        }
      }

      return session
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        if (!user.email) {
          console.error('Google account without email attempted to sign in')
          return false
        }
        
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            select: { id: true, email: true, role: true, status: true, accounts: true }
          })
          
          if (existingUser) {
            if (existingUser.status !== 'ACTIVE') {
              console.error('Inactive user attempted to sign in:', user.email)
              return false
            }
            
            if ((profile as any)?.picture && (profile as any).picture !== (existingUser as any).avatar) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { avatar: (profile as any).picture }
              })
            }
            
            if ((profile as any)?.name) {
              try {
                await prisma.user.update({
                  where: { id: existingUser.id },
                  data: { name: (profile as any).name }
                })
              } catch (e: any) {
                if (process.env.AUTH_DEBUG === 'true') console.warn('[auth] skip updating name on sign-in:', e?.code || e)
              }
            }
            
            const hasGoogleAccount = existingUser.accounts.some(
              (acc: any) => acc.provider === 'google'
            )
            
            if (!hasGoogleAccount) {
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  provider: 'google',
                  providerAccountId: account.providerAccountId,
                  type: account.type,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                }
              })
              
              console.log(`Linked Google account to existing user: ${user.email}`)
            }
          } else {
            console.log(`New Google user signing in: ${user.email}`)
          }
          
          return true
        } catch (error) {
          console.error('Error in signIn callback:', error)
          return false
        }
      }
      return false
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: shouldUseSecureCookies(),
        domain: getCookieDomain(),
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: shouldUseSecureCookies(),
        domain: getCookieDomain(),
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: shouldUseSecureCookies(),
        domain: getCookieDomain(),
      },
    },
  },
    })

    if (na && typeof na === 'object' && 'handlers' in na) {
      __nextAuth = na
    } else {
      const handler = na
      __nextAuth = {
        handlers: {
          GET: handler,
          POST: handler,
        },
        signIn: (..._args: any[]) => {
          return undefined as any
        },
        signOut: (..._args: any[]) => {
          return undefined as any
        },
        auth: (..._args: any[]) => {
          return undefined as any
        }
      }
    }
  }
  return __nextAuth
}

// Re-export（惰性获取）
export const handlers = {
  GET: (...args: any[]) => getNextAuth().handlers.GET(...args),
  POST: (...args: any[]) => getNextAuth().handlers.POST(...args),
}
export const signIn = (...args: any[]) => getNextAuth().signIn(...args)
export const signOut = (...args: any[]) => getNextAuth().signOut(...args)
export const auth: any = (...args: any[]) => (getNextAuth() as any).auth(...args)
