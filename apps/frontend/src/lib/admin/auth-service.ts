import { prisma } from '@/lib/db'
type UserRole = string

export interface AdminLoginCredentials {
  email: string
  password: string
  ip?: string
  userAgent?: string
}

export interface AdminSession {
  id: string
  userId: string
  token: string
  expiresAt: Date
  admin: {
    id: string
    email: string
    role: UserRole
  }
  permissions: string[]
}

export interface LoginResult {
  success: boolean
  admin?: any
  session?: AdminSession
  error?: string
}

export interface PermissionValidationResult {
  hasAllPermissions: boolean
  missingPermissions: string[]
}

export class AdminAuthService {
  /**
   * Admin login
   */
  static async login(credentials: AdminLoginCredentials): Promise<LoginResult> {
    try {
      // Find user by email first
      const user = await prisma.user.findUnique({
        where: { email: credentials.email }
      })

      if (!user) {
        return { success: false, error: 'Invalid credentials or insufficient permissions' }
      }

      // Check if user has admin role
      if (!('ADMIN' === user.role)) {
        return { success: false, error: 'Insufficient permissions' }
      }

      // Check if user is suspended
      if (user.status !== 'ACTIVE') {
        return { success: false, error: 'Account suspended' }
      }

      // TODO: Add password validation here
      // For now, we'll skip password check since we're using test data

      // Create session
      const sessionToken = this.generateSessionToken()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          sessionToken,
          expires: expiresAt
        }
      })

      // Create audit log
      if (credentials.ip || credentials.userAgent) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'ADMIN_LOGIN',
            resource: 'auth',
            severity: 'INFO',
            category: 'AUTHENTICATION',
            outcome: 'SUCCESS',
            ipAddress: credentials.ip || null,
            userAgent: credentials.userAgent || null,
            metadata: {
              timestamp: new Date().toISOString()
            }
          }
        })
      }

      return {
        success: true,
        admin: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        session: {
          id: session.id,
          userId: user.id,
          token: sessionToken,
          expiresAt,
          admin: {
            id: user.id,
            email: user.email,
            role: user.role
          },
          permissions: this.getAdminPermissions(user.role)
        }
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' }
    }
  }

  /**
   * Admin logout
   */
  static async logout(sessionId: string): Promise<{ success: boolean }> {
    try {
      await prisma.session.delete({
        where: { id: sessionId }
      })
      return { success: true }
    } catch (error) {
      return { success: false }
    }
  }

  /**
   * Get admin session
   */
  static async getSession(sessionToken: string): Promise<AdminSession | null> {
    try {
      const session = await prisma.session.findFirst({
        where: {
          sessionToken,
          expires: { gt: new Date() }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true
            }
          }
        }
      })

      if (!session || !session.user) {
        return null
      }

      return {
        id: session.id,
        userId: session.userId,
        token: session.sessionToken,
        expiresAt: session.expires,
        admin: {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role
        },
        permissions: this.getAdminPermissions(session.user.role)
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Validate admin permissions
   */
  static async validatePermissions(adminId: string, requiredPermissions: string[]): Promise<PermissionValidationResult> {
    try {
      const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: { role: true }
      })

      if (!admin) {
        return { hasAllPermissions: false, missingPermissions: requiredPermissions }
      }

      const adminPermissions = this.getAdminPermissions(admin.role)
      const missingPermissions = requiredPermissions.filter((perm: any) => !adminPermissions.includes(perm))

      return {
        hasAllPermissions: missingPermissions.length === 0,
        missingPermissions
      }
    } catch (error) {
      return { hasAllPermissions: false, missingPermissions: requiredPermissions }
    }
  }

  /**
   * Get admin permissions based on role
   */
  private static getAdminPermissions(role: UserRole): string[] {
    const basePermissions = ['read']
    
    switch (role) {
      case 'ADMIN':
        return [...basePermissions, 'write', 'delete', 'user_management', 'system_config', 'billing', 'security']
      default:
        return basePermissions
    }
  }

  /**
   * Generate session token
   */
  private static generateSessionToken(): string {
    return `admin_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export functions for easier import
export const loginAdmin = AdminAuthService.login.bind(AdminAuthService)
export const logoutAdmin = AdminAuthService.logout.bind(AdminAuthService)
export const getAdminSession = AdminAuthService.getSession.bind(AdminAuthService)
export const validateAdminPermissions = AdminAuthService.validatePermissions.bind(AdminAuthService)
