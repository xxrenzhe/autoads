/**
 * Authentication types and interfaces for the AdsCenter project
 * JWT authentication system with role-based access control
 */

import { ServiceConfig } from '@/lib/core/BaseService';

/**
 * User roles for role-based access control
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  GUEST = 'guest'
}

/**
 * User status
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

/**
 * Authentication token types
 */
export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh'
}

/**
 * User interface
 */
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  emailVerified: boolean;
  profile?: {
    avatar?: string;
    phone?: string;
    company?: string;
    department?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Authentication request/response interfaces
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  profile?: {
    avatar?: string;
    phone?: string;
    company?: string;
    department?: string;
  };
}

/**
 * Authentication response interfaces
 */
export interface LoginResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface RegisterResponse {
  user: Omit<User, 'password'>;
  message: string;
  requiresVerification: boolean;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: LoginResponse | RegisterResponse | RefreshTokenResponse;
  error?: string;
}

/**
 * JWT payload interface
 */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  username: string;
  role: UserRole;
  iat: number; // issued at
  exp: number; // expiration
  type: TokenType;
  jti?: string; // JWT ID
  sessionId?: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig extends ServiceConfig {
  jwt: {
    secret: string;
    accessTokenExpiry: number; // in seconds
    refreshTokenExpiry: number; // in seconds
    issuer: string;
    audience: string;
    algorithm: string;
  };
  bcrypt: {
    saltRounds: number;
  };
  cookie: {
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    domain?: string;
    path: string;
  };
  security: {
    maxLoginAttempts: number;
    lockoutDuration: number; // in seconds
    passwordMinLength: number;
    passwordMaxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    sessionTimeout: number; // in seconds
  };
  rbac: {
    enabled: boolean;
    defaultRole: UserRole;
    strictMode: boolean;
  };
}

/**
 * Default authentication configuration
 */
export const defaultAuthConfig: AuthConfig = {
  name: 'AuthService',
  version: '1.0.0',
  enabled: true,
  timeout: 30000,
  retries: 3,
  cacheEnabled: true,
  cacheTTL: 300,
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800, // 7 days
    issuer: process.env.NEXT_PUBLIC_DOMAIN || 'autoads.dev',
    audience: process.env.NEXT_PUBLIC_DOMAIN || 'autoads.dev',
    algorithm: 'HS256'
  },
  bcrypt: {
    saltRounds: 12
  },
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    domain: process.env.NEXT_PUBLIC_DOMAIN || 'autoads.dev'
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDuration: 900, // 15 minutes
    passwordMinLength: 8,
    passwordMaxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    sessionTimeout: 7200 // 2 hours
  },
  rbac: {
    enabled: true,
    defaultRole: UserRole.USER,
    strictMode: false
  }
};

/**
 * Authentication context interface
 */
export interface AuthContext {
  user: User;
  token: string;
  refreshToken?: string;
  sessionId: string;
  isAuthenticated: boolean;
  expiresAt: number;
}

/**
 * Authentication service interface
 */
export interface IAuthService {
  login(credentials: LoginRequest): Promise<LoginResponse>;
  register(userData: RegisterRequest): Promise<RegisterResponse>;
  logout(token: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<RefreshTokenResponse>;
  changePassword(userId: string, data: ChangePasswordRequest): Promise<void>;
  updateProfile(userId: string, data: UpdateProfileRequest): Promise<User>;
  validateToken(token: string): Promise<JwtPayload>;
  revokeToken(token: string): Promise<void>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUserStatus(userId: string, status: UserStatus): Promise<void>;
  resetPassword(email: string): Promise<void>;
  confirmResetPassword(token: string, newPassword: string): Promise<void>;
}

/**
 * RBAC (Role-Based Access Control) interface
 */
export interface IRBACService {
  hasRole(user: User, role: UserRole): boolean;
  hasAnyRole(user: User, roles: UserRole[]): boolean;
  hasAllRoles(user: User, roles: UserRole[]): boolean;
  canAccess(user: User, resource: string, action: string): boolean;
  getPermissions(user: User): string[];
  checkPermission(user: User, permission: string): boolean;
}

/**
 * Permission interface for RBAC
 */
export interface Permission {
  name: string;
  description: string;
  resource: string;
  action: string;
  roles: UserRole[];
}

/**
 * Predefined permissions for the application
 */
export const APPLICATION_PERMISSIONS: Permission[] = [
  // Admin permissions
  {
    name: 'admin:access',
    description: 'Access admin dashboard',
    resource: 'admin',
    action: 'access',
    roles: [UserRole.ADMIN]
  },
  {
    name: 'admin:users:manage',
    description: 'Manage users',
    resource: 'users',
    action: 'manage',
    roles: [UserRole.ADMIN]
  },
  {
    name: 'admin:settings:manage',
    description: 'Manage system settings',
    resource: 'settings',
    action: 'manage',
    roles: [UserRole.ADMIN]
  },
  
  // Manager permissions
  {
    name: 'manager:dashboard:access',
    description: 'Access manager dashboard',
    resource: 'dashboard',
    action: 'access',
    roles: [UserRole.ADMIN, UserRole.MANAGER]
  },
  {
    name: 'manager:reports:view',
    description: 'View reports',
    resource: 'reports',
    action: 'view',
    roles: [UserRole.ADMIN, UserRole.MANAGER]
  },
  
  // User permissions
  {
    name: 'user:profile:read',
    description: 'Read user profile',
    resource: 'profile',
    action: 'read',
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]
  },
  {
    name: 'user:profile:update',
    description: 'Update user profile',
    resource: 'profile',
    action: 'update',
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]
  },
  
  // Guest permissions
  {
    name: 'guest:public:access',
    description: 'Access public content',
    resource: 'public',
    action: 'access',
    roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.GUEST]
  }
];

/**
 * Authentication error types
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  PASSWORD_MISMATCH = 'PASSWORD_MISMATCH',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

/**
 * Authentication error class
 */
export class AuthError extends Error {
  public readonly type: AuthErrorType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    type: AuthErrorType,
    message: string,
    statusCode: number = 401,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}

/**
 * Authentication utilities
 */
export interface AuthUtils {
  generateSecureToken(length: number): string;
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] };
  hashPassword(password: string): Promise<string>;
  comparePasswords(password: string, hashedPassword: string): Promise<boolean>;
  sanitizeUser(user: User): Omit<User, 'password'>;
  isTokenExpired(token: string): boolean;
  extractTokenFromHeader(header: string): string | null;
  extractTokenFromCookie(cookies: string): string | null;
}