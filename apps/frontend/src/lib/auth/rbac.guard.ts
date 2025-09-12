/**
 * RBAC Guard - Role-Based Access Control implementation
 * Provides decorators and middleware for protecting routes and resources
 */

import { EnhancedError } from '@/lib/utils/error-handling';
import { NextRequest, NextResponse  } from 'next/server';
import { BaseService, ServiceContext } from '@/lib/core/BaseService';
import { Logger } from '@/lib/core/Logger';
import { AuthService } from './auth.service';
import { 
  User, 
  UserRole, 
  AuthError, 
  AuthErrorType, 
  Permission, 
  APPLICATION_PERMISSIONS,
  IRBACService 
} from '@/types/auth';

/**
 * RBAC Guard implementation
 */
export class RBACGuard extends BaseService implements IRBACService {
  protected authService: AuthService;
  private permissions: Permission[];
  private strictMode: boolean;

  constructor(
    authService: AuthService,
    permissions: Permission[] = APPLICATION_PERMISSIONS,
    strictMode: boolean = false
  ) {
    super({
      name: 'RBACGuard',
      version: '1.0.0',
      enabled: true,
      timeout: 5000,
      retries: 1,
      cacheEnabled: true,
      cacheTTL: 600
    });

    this.authService = authService;
    this.permissions = permissions;
    this.strictMode = strictMode;
    this.logger = new Logger('RBACGuard');
  }

  protected override async onInitialize(): Promise<void> {
    this.logger.info('Initializing RBAC guard');
    await this.authService.initialize();
    this.logger.info(`RBAC guard initialized with ${this.permissions.length} permissions`);
  }

  protected async onStart(): Promise<void> {
    this.logger.info('Starting RBAC guard');
    await this.authService.start();
  }

  protected async onStop(): Promise<void> {
    this.logger.info('Stopping RBAC guard');
    await this.authService.stop();
  }

  protected async onDestroy(): Promise<void> {
    this.logger.info('Destroying RBAC guard');
    await this.authService.destroy();
  }

  protected async onHealthCheck(): Promise<unknown> {
    return {
      status: 'healthy',
      service: this.name,
      version: this.version,
      permissionsCount: this.permissions.length,
      strictMode: this.strictMode
    };
  }

  /**
   * Check if user has a specific role
   */
  hasRole(user: User, role: UserRole): boolean {
    if (this.strictMode && user.status !== 'active') {
      return false;
    }
    return user.role === role;
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(user: User, roles: UserRole[]): boolean {
    if (this.strictMode && user.status !== 'active') {
      return false;
    }
    return roles.includes(user.role);
  }

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(user: User, roles: UserRole[]): boolean {
    if (this.strictMode && user.status !== 'active') {
      return false;
    }
    return roles.every(role => user.role === role);
  }

  /**
   * Check if user can access a specific resource with a specific action
   */
  canAccess(user: User, resource: string, action: string): boolean {
    if (this.strictMode && user.status !== 'active') {
      return false;
    }

    const permission = this.permissions.find(p => 
      p.resource === resource && p.action === action
    );

    if (!permission) {
      // If no specific permission found, deny access in strict mode
      return !this.strictMode;
    }

    return permission.roles.includes(user.role);
  }

  /**
   * Get all permissions for a user
   */
  getPermissions(user: User): string[] {
    if (this.strictMode && user.status !== 'active') {
      return [];
    }

    return this.permissions
      .filter(permission => permission.roles.includes(user.role))
      ?.filter(Boolean)?.map(permission => permission.name);
  }

  /**
   * Check if user has a specific permission
   */
  checkPermission(user: User, permissionName: string): boolean {
    if (this.strictMode && user.status !== 'active') {
      return false;
    }

    const permission = this.permissions.find(p => p.name === permissionName);
    if (!permission) {
      return !this.strictMode;
    }

    return permission.roles.includes(user.role);
  }

  /**
   * Middleware factory for protecting routes
   */
  requireRoles(roles: UserRole[] | UserRole) {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    return async (request: NextRequest, context?: { user?: User }) => {
      const user = context?.user;
      
      if (!user) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Authentication required',
          401
        );
      }

      if (!this.hasAnyRole(user, requiredRoles)) {
        throw new AuthError(
          AuthErrorType.INSUFFICIENT_PERMISSIONS,
          `Required roles: ${requiredRoles.join(', ')}`,
          403
        );
      }

      return user;
    };
  }

  /**
   * Middleware factory for requiring specific permissions
   */
  requirePermissions(permissions: string[] | string) {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    
    return async (request: NextRequest, context?: { user?: User }) => {
      const user = context?.user;
      
      if (!user) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Authentication required',
          401
        );
      }

      const missingPermissions = requiredPermissions.filter(permission => 
        !this.checkPermission(user, permission)
      );

      if (missingPermissions.length > 0) {
        throw new AuthError(
          AuthErrorType.INSUFFICIENT_PERMISSIONS,
          `Required permissions: ${missingPermissions.join(', ')}`,
          403
        );
      }

      return user;
    };
  }

  /**
   * Middleware factory for resource-based access control
   */
  requireResourceAccess(resource: string, action: string) {
    return async (request: NextRequest, context?: { user?: User }) => {
      const user = context?.user;
      
      if (!user) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Authentication required',
          401
        );
      }

      if (!this.canAccess(user, resource, action)) {
        throw new AuthError(
          AuthErrorType.INSUFFICIENT_PERMISSIONS,
          `Access denied to ${resource}:${action}`,
          403
        );
      }

      return user;
    };
  }

  /**
   * Factory method for creating route handlers with authentication
   */
  createAuthenticatedHandler<T>(
    handler: (request: NextRequest, context: { user: User }) => Promise<T>,
    options?: {
      roles?: UserRole[] | UserRole;
      permissions?: string[] | string;
      resource?: string;
      action?: string;
    }
  ) {
    // eslint-disable-next-line
    const self = this;
    
    return async (request: NextRequest): Promise<NextResponse> => {
      try {
        // Extract token from request
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
          throw new AuthError(
            AuthErrorType.INVALID_TOKEN,
            'Authentication token required',
            401
          );
        }

        // Validate token and get user
        const payload = await self.authService.validateToken(token);
        const user = await self.authService.getUserById(payload.sub);

        if (!user) {
          throw new AuthError(
            AuthErrorType.USER_NOT_FOUND,
            'User not found',
            404
          );
        }

        // Apply role-based checks
        if (options?.roles) {
          const requiredRoles = Array.isArray(options.roles) ? options.roles : [options.roles];
          if (!self.hasAnyRole(user, requiredRoles)) {
            throw new AuthError(
              AuthErrorType.INSUFFICIENT_PERMISSIONS,
              `Required roles: ${requiredRoles.join(', ')}`,
              403
            );
          }
        }

        // Apply permission-based checks
        if (options?.permissions) {
          const requiredPermissions = Array.isArray(options.permissions) ? options.permissions : [options.permissions];
          const missingPermissions = requiredPermissions.filter(permission => 
            !self.checkPermission(user, permission)
          );

          if (missingPermissions.length > 0) {
            throw new AuthError(
              AuthErrorType.INSUFFICIENT_PERMISSIONS,
              `Required permissions: ${missingPermissions.join(', ')}`,
              403
            );
          }
        }

        // Apply resource-based checks
        if (options?.resource && options?.action) {
          if (!self.canAccess(user, options.resource, options.action)) {
            throw new AuthError(
              AuthErrorType.INSUFFICIENT_PERMISSIONS,
              `Access denied to ${options.resource}:${options.action}`,
              403
            );
          }
        }

        // Execute the handler
        const result = await handler(request, { user });
        
        return NextResponse.json({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        if (error instanceof AuthError) {
          return NextResponse.json({
            success: false,
            error: error.message,
            type: error.type,
            timestamp: new Date().toISOString()
          }, { status: error.statusCode });
        }

        self.logger.error('Authentication handler error', new EnhancedError('Authentication handler error', { error: error instanceof Error ? error.message : String(error) 
         }));

        return NextResponse.json({
          success: false,
          error: 'Internal server error',
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    };
  }

  /**
   * Decorator for class-based route handlers
   */
  authenticate(options?: {
    roles?: UserRole[] | UserRole;
    permissions?: string[] | string;
    resource?: string;
    action?: string;
  }) {
    return function <T extends { new (...args: any[]): any }>(constructor: T) {
      return class extends constructor {
        constructor(...args: any[]) {
          super(...args);
          this.authOptions = options;
        }
      };
    };
  }

  /**
   * Method decorator for protecting individual methods
   */
  requireAuth(options?: {
    roles?: UserRole[] | UserRole;
    permissions?: string[] | string;
    resource?: string;
    action?: string;
  }) {
    const authService = this.authService;
    const permissions = this.permissions;
    const strictMode = this.strictMode;
    const logger = this.logger;
    
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (request: NextRequest, ...args: any[]) {
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
          throw new AuthError(
            AuthErrorType.INVALID_TOKEN,
            'Authentication token required',
            401
          );
        }

        const payload = await authService.validateToken(token);
        const user = await authService.getUserById(payload.sub);

        if (!user) {
          throw new AuthError(
            AuthErrorType.USER_NOT_FOUND,
            'User not found',
            404
          );
        }

        // Apply checks
        if (options?.roles) {
          const requiredRoles = Array.isArray(options.roles) ? options.roles : [options.roles];
          if (!hasAnyRole(user, requiredRoles)) {
            throw new AuthError(
              AuthErrorType.INSUFFICIENT_PERMISSIONS,
              `Required roles: ${requiredRoles.join(', ')}`,
              403
            );
          }
        }

        if (options?.permissions) {
          const requiredPermissions = Array.isArray(options.permissions) ? options.permissions : [options.permissions];
          const missingPermissions = requiredPermissions.filter(permission => 
            !checkPermission(user, permission)
          );

          if (missingPermissions.length > 0) {
            throw new AuthError(
              AuthErrorType.INSUFFICIENT_PERMISSIONS,
              `Required permissions: ${missingPermissions.join(', ')}`,
              403
            );
          }
        }

        if (options?.resource && options?.action) {
          if (!canAccess(user, options.resource, options.action)) {
            throw new AuthError(
              AuthErrorType.INSUFFICIENT_PERMISSIONS,
              `Access denied to ${options.resource}:${options.action}`,
              403
            );
          }
        }

        return originalMethod.call(this, request, ...args);
      };

      return descriptor;
    };

    // Helper functions to avoid this aliasing
    function hasAnyRole(user: User, roles: UserRole[]): boolean {
      if (strictMode && user.status !== 'active') {
        return false;
      }
      return roles.includes(user.role);
    }

    function checkPermission(user: User, permissionName: string): boolean {
      if (strictMode && user.status !== 'active') {
        return false;
      }

      const permission = permissions.find(p => p.name === permissionName);
      if (!permission) {
        return !strictMode;
      }

      return permission.roles.includes(user.role);
    }

    function canAccess(user: User, resource: string, action: string): boolean {
      if (strictMode && user.status !== 'active') {
        return false;
      }

      const permission = permissions.find(p => 
        p.resource === resource && p.action === action
      );

      if (!permission) {
        return !strictMode;
      }

      return permission.roles.includes(user.role);
    }
  }

  /**
   * Add custom permission
   */
  addPermission(permission: Permission): void {
    const existingIndex = this.permissions.findIndex(p => p.name === permission.name);
    
    if (existingIndex >= 0) {
      this.permissions[existingIndex] = permission;
    } else {
      this.permissions.push(permission);
    }

    this.logger.info('Permission added/updated', { 
      permission: permission.name,
      resource: permission.resource,
      action: permission.action
    });
  }

  /**
   * Remove permission
   */
  removePermission(permissionName: string): boolean {
    const index = this.permissions.findIndex(p => p.name === permissionName);
    
    if (index >= 0) {
      this.permissions.splice(index, 1);
      this.logger.info('Permission removed', { permission: permissionName });
      return true;
    }

    return false;
  }

  /**
   * Get all permissions
   */
  getAllPermissions(): Permission[] {
    return [...this.permissions];
  }

  /**
   * Get permissions by role
   */
  getPermissionsByRole(role: UserRole): Permission[] {
    return this.permissions.filter(permission => permission.roles.includes(role));
  }

  /**
   * Update strict mode
   */
  setStrictMode(strict: boolean): void {
    this.strictMode = strict;
    this.logger.info('Strict mode updated', { strictMode: strict });
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      strictMode: this.strictMode,
      permissionsCount: this.permissions.length,
      roles: Object.values(UserRole)
    };
  }
}

// Export decorator utilities
export const RequireAuth = RBACGuard.prototype.authenticate;
export const RequireRoles = RBACGuard.prototype.requireRoles;
export const RequirePermissions = RBACGuard.prototype.requirePermissions;
export const RequireResourceAccess = RBACGuard.prototype.requireResourceAccess;

export default RBACGuard;