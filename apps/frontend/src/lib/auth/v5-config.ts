import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import * as bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { 
  getAuthUrl, 
  shouldUseSecureCookies, 
  getCookiePrefix, 
  getCSRFCookiePrefix,
  getCookieDomain,
  logAuthConfig 
} from './auth-config'

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

// 在启动时打印配置信息
logAuthConfig()

// 处理新用户的订阅创建（支持邀请码）
export async function handleNewUserSubscription(userId: string, userEmail: string, invitationCode?: string) {
  try {
    let subscriptionCreated = false
    
    if (invitationCode) {
      // 如果有邀请码，尝试应用邀请
      const { InvitationService } = await import('@/lib/services/invitation-service')
      const invitationResult = await InvitationService.acceptInvitation(invitationCode, userId)
      
      if (invitationResult.success) {
        console.log(`Applied invitation subscription for new OAuth user: ${userEmail}`)
        subscriptionCreated = true
      } else {
        console.log(`Failed to apply invitation for new user ${userEmail}: ${invitationResult.error}`)
      }
    }
    
    // 如果没有创建订阅（没有邀请码或邀请失败），创建14天试用
    if (!subscriptionCreated) {
      const { SubscriptionHelper } = await import('@/lib/services/subscription-helper')
      const proPlan = await prisma.plan.findFirst({
        where: { name: 'pro', isActive: true }
      })
      
      if (proPlan) {
        const trialSubscription = await SubscriptionHelper.createTrialSubscription(userId, proPlan.id)
        
        // 标记试用已使用
        await prisma.user.update({
          where: { id: userId },
          data: { trialUsed: true }
        })
        
        console.log(`Created 14-day Pro trial for OAuth user: ${userEmail}`)
      } else {
        // 回退到免费计划
        const freePlan = await prisma.plan.findFirst({
          where: { name: 'free', isActive: true }
        })
        
        if (freePlan) {
          const startDate = new Date()
          const endDate = new Date()
          endDate.setFullYear(endDate.getFullYear() + 10)
          
          await prisma.subscription.create({
            data: {
              userId,
              planId: freePlan.id,
              status: 'ACTIVE',
              currentPeriodStart: startDate,
              currentPeriodEnd: endDate,
              provider: 'system',
              providerSubscriptionId: `free_${userId}_${Date.now()}`
            }
          })
          
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTokenBalance: freePlan.tokenQuota,
              tokenBalance: Math.max(0, freePlan.tokenQuota)
            }
          })
          
          console.log(`Created free subscription for OAuth user: ${userEmail}`)
        }
      }
    }
  } catch (error) {
    console.error('Error handling new user subscription:', error)
  }
}

// Custom adapter to handle field mapping between NextAuth and Prisma
const customAdapter = {
  ...PrismaAdapter(prisma),
  async createUser(data: any) {
    // Convert NextAuth fields to Prisma schema
    const { emailVerified, image, ...userData } = data
    
    // Create user in Prisma format
    const user = await prisma.user.create({
      data: {
        ...userData,
        // Convert Date to boolean for Prisma
        emailVerified: emailVerified ? true : false,
        // Map image to avatar
        avatar: image || null,
      }
    })
    
    // Note: Subscription creation is now handled in the session callback
    // to properly handle invitation codes for OAuth users
    
    // Auto-generate invitation code for new users
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
    
    // Return in NextAuth format with proper type conversions
    // Add a flag to indicate this is a new user
    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      emailVerified: user.emailVerified ? new Date() : null,
      image: user.avatar || undefined,
      role: user.role,
      status: user.status,
      isNewUser: true  // Flag to identify new users
    }
  }
}

const __nextAuth = NextAuth({
  adapter: customAdapter,
  secret: process.env.AUTH_SECRET,
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
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          // Only prompt for consent on first login or when scopes change
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          // Removed hd restriction to allow all Google accounts
          // We'll validate email domain in the signIn callback instead
          // Request basic profile and email
          scope: "openid email profile"
        }
      },
      // Optional: Add profile customization
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          emailVerified: profile.email_verified ? true : false,
          role: 'USER', // Default role
          status: 'ACTIVE' // Default status
        }
      }
    }),
    Credentials({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@autoads.dev' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials: Record<"email" | "password", string> | undefined, _req) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[auth][debug] Missing email or password')
          return null
        }

        const email = credentials.email
        const password = credentials.password

        console.log('[auth][debug] Attempting admin login for email:', email)

        // Single query to fetch user with only needed fields
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            status: true,
            emailVerified: true,
          }
        })

        if (!user) {
          console.log('[auth][debug] User not found:', email)
          return null
        }

        // Check all conditions in sequence for early return
        if (!user.password) {
          console.log('[auth][debug] User has no password set:', email)
          return null
        }

        // Only allow ADMIN role to use credentials login
        if (user.role !== 'ADMIN') {
          console.log('[auth][debug] Access denied: Non-admin user attempting credentials login:', user.role)
          return null
        }

        if (user.status !== 'ACTIVE') {
          console.log('[auth][debug] User is not active:', email)
          return null
        }

        // Verify password
        console.log('[auth][debug] Verifying password for admin user:', email)
        const isValidPassword = await bcrypt.compare(password, user.password)

        if (!isValidPassword) {
          console.log('[auth][debug] Password verification failed for admin user:', email)
          return null
        }

        console.log('[auth][debug] Admin login successful for user:', email, 'with role:', user.role)

        // Return user object
        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
        }
      }
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (optimized)
    updateAge: 24 * 60 * 60, // Update session every 24 hours for auto-renewal
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token and user id to the token right after signin
      if (account && user) {
        token.accessToken = account.access_token
        token.userId = user.id
        // Save user info to token for session callback
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.emailVerified = user.emailVerified ? true : false
        // Save role and status for credentials provider
        token.role = user.role
        token.status = user.status
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user id from the token
      const typedSession = session as any
      typedSession.accessToken = token.accessToken as string
      typedSession.userId = token.userId as string
      
      // Ensure session.user exists
      if (!typedSession.user) {
        typedSession.user = {}
      }
      
      // For credentials provider (admin users), use token data directly
      if (token.role) {
        typedSession.user = {
          id: token.userId as string,
          email: token.email as string,
          name: token.name as string,
          image: token.picture as string,
          role: token.role as string,
          status: token.status as string,
          emailVerified: token.emailVerified as boolean,
        }
        return typedSession
      }
      
      // For OAuth providers (Google), fetch user from database
      if (token.userId && token.email) {
        // Use a single query with update to reduce database calls
        const user = await prisma.user.findUnique({
          where: { id: token.userId },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            status: true,
            tokenBalance: true,
            lastLoginAt: true,
            emailVerified: true,
          }
        })
        
        if (user) {
          // Batch all updates in a single operation
          const updateData: any = { lastLoginAt: new Date() }
          let needsUpdate = false
          
          // Only update if data actually changed
          if (token.picture && token.picture !== user.avatar) {
            updateData.avatar = token.picture
            needsUpdate = true
          }
          
          if (token.name && token.name !== user.name) {
            updateData.name = token.name
            needsUpdate = true
          }
          
          // Perform update if needed
          if (needsUpdate) {
            await prisma.user.update({
              where: { id: user.id },
              data: updateData
            })
          } else if (!user.lastLoginAt || new Date().getTime() - user.lastLoginAt.getTime() > 300000) { // 5 minutes
            // Only update lastLoginAt if it's been more than 5 minutes
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() }
            })
          }
          
          // Set session user data
          typedSession.user = {
            ...session.user,
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.avatar,
            role: user.role,
            status: user.status,
            isActive: user.status === 'ACTIVE',
            emailVerified: user.emailVerified,
          }
          
          // Record device information for anti-cheat - this needs to be handled elsewhere
          // as request is not available in the session callback
          
          return typedSession
        }
      }
      
      return session
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        // Allow all Google accounts (unified Google authentication)
        if (!user.email) {
          console.error('Google account without email attempted to sign in')
          return false
        }
        
        try {
          // Check if user already exists with this email
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { accounts: true }
          })
          
          if (existingUser) {
            // Check if user is active
            if (existingUser.status !== 'ACTIVE') {
              console.error('Inactive user attempted to sign in:', user.email)
              return false
            }
            
            // Update avatar if it's different
            if ((profile as any)?.picture && (profile as any).picture !== existingUser.avatar) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { avatar: (profile as any).picture }
              })
            }
            
            // Update name if it's different
            if ((profile as any)?.name && (profile as any).name !== existingUser.name) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { name: (profile as any).name }
              })
            }
            
            // Check if user already has a Google account linked
            const hasGoogleAccount = existingUser.accounts.some(
              (acc: any) => acc.provider === 'google'
            )
            
            if (!hasGoogleAccount) {
              // Link the Google account to the existing user
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
            // New user - the adapter will handle creation
            console.log(`New Google user signing in: ${user.email}`)
            // The Pro trial subscription will be created in the custom adapter's createUser method
          }
          
          return true
        } catch (error) {
          console.error('Error in signIn callback:', error)
          return false
        }
      } else if (account?.provider === 'credentials') {
        // For credentials provider, allow admin users
        console.log('[auth][debug] Credentials provider sign-in attempt')
        return true
      }
      
      return false // Deny other providers
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

// Re-export with relaxed types to avoid strict signature mismatches across call sites
export const handlers = __nextAuth.handlers
export const signIn = __nextAuth.signIn
export const signOut = __nextAuth.signOut
// Cast auth to any to accept 0/1/2 arguments depending on usage context
export const auth: any = __nextAuth.auth
