/**
 * Authentication Service - Core authentication logic with password hashing
 * Handles user authentication, registration, and session management
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { BaseService, ServiceContext } from '@/lib/core/BaseService';
import { Logger } from '@/lib/core/Logger';
import { Cache } from '@/lib/core/Cache';
import { JWTService } from './jwt.service';
import { 
  User, 
  UserRole, 
  UserStatus, 
  TokenType,
  LoginRequest, 
  RegisterRequest, 
  LoginResponse, 
  RegisterResponse, 
  RefreshTokenResponse, 
  ChangePasswordRequest, 
  UpdateProfileRequest,
  AuthConfig,
  defaultAuthConfig,
  AuthError,
  AuthErrorType,
  IAuthService
} from '@/types/auth';

// In a real implementation, this would be replaced with a proper database
// For now, we'll use in-memory storage for demonstration
interface UserRecord extends User {
  password: string;
  loginAttempts: number;
  lockoutUntil?: number;
  refreshTokens: string[];
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: number;
}

export class AuthService extends BaseService implements IAuthService {
  protected jwtService: JWTService;
  
  // Auth-specific configuration
  protected get authConfig(): AuthConfig {
    return this.config as AuthConfig;
  }
  
  // In-memory user storage (replace with database in production)
  private users: Map<string, UserRecord> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private usernameIndex: Map<string, string> = new Map();

  constructor(config?: Partial<AuthConfig>) {
    const mergedConfig = { ...defaultAuthConfig, ...config };
    super({
      ...mergedConfig,
      name: 'AuthService',
      version: '1.0.0'
    });

    // Config is already set in the super() call
    this.jwtService = new JWTService(config);
  }

  protected override async onInitialize(): Promise<void> {
    this.logger.info('Initializing authentication service');
    
    // Initialize JWT service
    await this.jwtService.initialize();
    
    // Create default admin user if no users exist
    if (this.users.size === 0) {
      await this.createDefaultAdminUser();
    }

    this.logger.info('Authentication service initialized successfully');
  }

  protected override async onStart(): Promise<void> {
    this.logger.info('Starting authentication service');
    await this.jwtService.start();
  }

  protected override async onStop(): Promise<void> {
    this.logger.info('Stopping authentication service');
    await this.jwtService.stop();
  }

  protected async onDestroy(): Promise<void> {
    this.logger.info('Destroying authentication service');
    await this.jwtService.destroy();
  }

  protected async onHealthCheck(): Promise<unknown> {
    return {
      status: 'healthy',
      service: this.name,
      version: this.version,
      userCount: this.users.size,
      jwtService: await this.jwtService.healthCheck()
    };
  }

  /**
   * User authentication
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'login', email: credentials.email }
    };

    return this.withErrorHandling(async () => {
      // Validate input
      if (!credentials.email || !credentials.password) {
        throw new AuthError(
          AuthErrorType.INVALID_CREDENTIALS,
          'Email and password are required',
          400
        );
      }

      // Find user by email
      const user = await this.getUserRecordByEmail(credentials.email);
      if (!user) {
        throw new AuthError(
          AuthErrorType.INVALID_CREDENTIALS,
          'Invalid email or password',
          401
        );
      }

      // Check account status
      if (user.status === UserStatus.SUSPENDED) {
        throw new AuthError(
          AuthErrorType.ACCOUNT_LOCKED,
          'Account is suspended',
          403
        );
      }

      if (user.status === UserStatus.INACTIVE) {
        throw new AuthError(
          AuthErrorType.ACCOUNT_INACTIVE,
          'Account is inactive',
          403
        );
      }

      // Check account lockout
      if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
        const lockoutTimeLeft = Math.ceil((user.lockoutUntil - Date.now()) / 1000 / 60);
        throw new AuthError(
          AuthErrorType.ACCOUNT_LOCKED,
          `Account is locked. Try again in ${lockoutTimeLeft} minutes`,
          423
        );
      }

      // Validate password
      const isPasswordValid = await this.comparePasswords(credentials.password, user.password);
      if (!isPasswordValid) {
        await this.incrementLoginAttempts(user.id);
        throw new AuthError(
          AuthErrorType.INVALID_CREDENTIALS,
          'Invalid email or password',
          401
        );
      }

      // Check email verification
      if (!user.emailVerified) {
        throw new AuthError(
          AuthErrorType.EMAIL_NOT_VERIFIED,
          'Please verify your email address',
          403
        );
      }

      // Reset login attempts on successful login
      await this.resetLoginAttempts(user.id);

      // Generate tokens
      const { accessToken, refreshToken } = await this.jwtService.generateTokenPair(
        user.id,
        user.email,
        user.username,
        user.role
      );

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Update last login
      await this.updateLastLogin(user.id);

      this.logger.info('User logged in successfully', { 
        userId: user.id, 
        email: user.email 
      });

      return {
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken,
        expiresIn: this.authConfig.jwt.accessTokenExpiry,
        tokenType: 'Bearer'
      };
    }, context, 'login');
  }

  /**
   * User registration
   */
  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'register', email: userData.email, username: userData.username }
    };

    return this.withErrorHandling(async () => {
      // Validate input
      const validation = this.validateRegistrationData(userData);
      if (!validation.isValid) {
        throw new AuthError(
          AuthErrorType.INVALID_PASSWORD,
          validation.errors.join(', '),
          400
        );
      }

      // Check if user already exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new AuthError(
          AuthErrorType.USER_ALREADY_EXISTS,
          'User with this email already exists',
          409
        );
      }

      const existingUsername = await this.getUserByUsername(userData.username);
      if (existingUsername) {
        throw new AuthError(
          AuthErrorType.USER_ALREADY_EXISTS,
          'Username already taken',
          409
        );
      }

      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);

      // Create user
      const newUser: UserRecord = {
        id: uuidv4(),
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: hashedPassword,
        role: userData.role || this.authConfig.rbac.defaultRole,
        status: UserStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        emailVerified: false,
        loginAttempts: 0,
        refreshTokens: [],
        emailVerificationToken: uuidv4()
      };

      // Store user
      this.users.set(newUser.id, newUser);
      this.emailIndex.set(newUser.email, newUser.id);
      this.usernameIndex.set(newUser.username, newUser.id);

      // In a real implementation, send verification email
      // await this.sendVerificationEmail(newUser.email, newUser.emailVerificationToken);

      this.logger.info('User registered successfully', { 
        userId: newUser.id, 
        email: newUser.email,
        username: newUser.username
      });

      return {
        user: this.sanitizeUser(newUser),
        message: 'User registered successfully. Please check your email for verification.',
        requiresVerification: true
      };
    }, context, 'register');
  }

  /**
   * User logout
   */
  async logout(token: string): Promise<void> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'logout' }
    };

    return this.withErrorHandling(async () => {
      // Validate token
      const payload = await this.jwtService.validateToken(token);
      
      // Revoke token
      await this.jwtService.revokeToken(token, 'User logout');
      
      // Remove refresh token from user record
      const user = await this.getUserById(payload.sub);
      if (user) {
        await this.removeRefreshToken(user.id, token);
      }

      this.logger.info('User logged out successfully', { 
        userId: payload.sub,
        tokenId: payload.jti
      });
    }, context, 'logout');
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'refreshToken' }
    };

    return this.withErrorHandling(async () => {
      // Validate refresh token
      const payload = await this.jwtService.validateToken(refreshToken, TokenType.REFRESH);
      
      // Check if refresh token is valid for user
      const user = await this.getUserRecordById(payload.sub);
      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Invalid refresh token',
          401
        );
      }

      // Generate new token pair
      const { accessToken, refreshToken: newRefreshToken } = await this.jwtService.generateTokenPair(
        user.id,
        user.email,
        user.username,
        user.role
      );

      // Replace old refresh token with new one
      await this.removeRefreshToken(user.id, refreshToken);
      await this.storeRefreshToken(user.id, newRefreshToken);

      this.logger.info('Token refreshed successfully', { 
        userId: user.id,
        oldTokenId: payload.jti
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.authConfig.jwt.accessTokenExpiry,
        tokenType: 'Bearer'
      };
    }, context, 'refreshToken');
  }

  /**
   * Change password
   */
  async changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      userId,
      metadata: { operation: 'changePassword' }
    };

    return this.withErrorHandling(async () => {
      // Validate input
      if (data.newPassword !== data.confirmPassword) {
        throw new AuthError(
          AuthErrorType.PASSWORD_MISMATCH,
          'New passwords do not match',
          400
        );
      }

      const passwordValidation = this.validatePasswordStrength(data.newPassword);
      if (!passwordValidation.isValid) {
        throw new AuthError(
          AuthErrorType.INVALID_PASSWORD,
          passwordValidation.errors.join(', '),
          400
        );
      }

      // Get user
      const user = await this.getUserRecordById(userId);
      if (!user) {
        throw new AuthError(
          AuthErrorType.USER_NOT_FOUND,
          'User not found',
          404
        );
      }

      // Verify current password
      const isCurrentPasswordValid = await this.comparePasswords(data.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AuthError(
          AuthErrorType.INVALID_PASSWORD,
          'Current password is incorrect',
          400
        );
      }

      // Hash new password
      const newHashedPassword = await this.hashPassword(data.newPassword);

      // Update password
      await this.updateUserPassword(userId, newHashedPassword);

      // Revoke all refresh tokens
      await this.revokeAllRefreshTokens(userId);

      this.logger.info('Password changed successfully', { userId });
    }, context, 'changePassword');
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<User> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      userId,
      metadata: { operation: 'updateProfile' }
    };

    return this.withErrorHandling(async () => {
      const user = await this.getUserRecordById(userId);
      if (!user) {
        throw new AuthError(
          AuthErrorType.USER_NOT_FOUND,
          'User not found',
          404
        );
      }

      // Update user data
      const updatedUser: UserRecord = {
        ...user,
        firstName: data.firstName || user.firstName,
        lastName: data.lastName || user.lastName,
        profile: {
          ...user.profile,
          ...data.profile
        },
        updatedAt: new Date().toISOString()
      };

      // Store updated user
      this.users.set(userId, updatedUser);

      this.logger.info('Profile updated successfully', { userId });

      return this.sanitizeUser(updatedUser);
    }, context, 'updateProfile');
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<any> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'validateToken' }
    };

    return this.withErrorHandling(async () => {
      const payload = await this.jwtService.validateToken(token);
      
      // Check if user still exists and is active
      const user = await this.getUserById(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'User account is not active',
          401
        );
      }

      return payload;
    }, context, 'validateToken');
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<void> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'revokeToken' }
    };

    return this.withErrorHandling(async () => {
      await this.jwtService.revokeToken(token, 'Manual revocation');
    }, context, 'revokeToken');
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? this.sanitizeUser(user) : null;
  }

  /**
   * Get full user record by ID (internal use only)
   */
  private async getUserRecordById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) || null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    if (!userId) {
      return null as any;
    }
    return this.getUserById(userId);
  }

  /**
   * Get full user record by email (internal use only)
   */
  private async getUserRecordByEmail(email: string): Promise<UserRecord | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    if (!userId) {
      return null as any;
    }
    return this.getUserRecordById(userId);
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usernameIndex.get(username.toLowerCase());
    if (!userId) {
      return null as any;
    }
    return this.getUserById(userId);
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId: string, status: UserStatus): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new AuthError(
        AuthErrorType.USER_NOT_FOUND,
        'User not found',
        404
      );
    }

    user.status = status;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);

    this.logger.info('User status updated', { userId, status });
  }

  /**
   * Reset password (forgot password flow)
   */
  async resetPassword(email: string): Promise<void> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'resetPassword', email }
    };

    return this.withErrorHandling(async () => {
      const user = await this.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        this.logger.info('Password reset requested for non-existent email', { email });
        return;
      }

      // Generate reset token
      const resetToken = uuidv4();
      const resetExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

      const userRecord = this.users.get(user.id);
      if (userRecord) {
        userRecord.passwordResetToken = resetToken;
        userRecord.passwordResetExpires = resetExpires;
        userRecord.updatedAt = new Date().toISOString();
        this.users.set(user.id, userRecord);
      }

      // In a real implementation, send reset email
      // await this.sendPasswordResetEmail(user.email, resetToken);

      this.logger.info('Password reset initiated', { userId: user.id, email });
    }, context, 'resetPassword');
  }

  /**
   * Confirm password reset
   */
  async confirmResetPassword(token: string, newPassword: string): Promise<void> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'confirmResetPassword' }
    };

    return this.withErrorHandling(async () => {
      // Find user by reset token
      let userRecord: UserRecord | undefined;
      for (const user of this.users.values()) {
        if (user.passwordResetToken === token) {
          userRecord = user;
          break;
        }
      }

      if (!userRecord || !userRecord.passwordResetExpires || userRecord.passwordResetExpires < Date.now()) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Invalid or expired reset token',
          400
        );
      }

      // Validate new password
      const passwordValidation = this.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new AuthError(
          AuthErrorType.INVALID_PASSWORD,
          passwordValidation.errors.join(', '),
          400
        );
      }

      // Update password
      const hashedPassword = await this.hashPassword(newPassword);
      await this.updateUserPassword(userRecord.id, hashedPassword);

      // Clear reset token
      userRecord.passwordResetToken = undefined;
      userRecord.passwordResetExpires = undefined;
      userRecord.updatedAt = new Date().toISOString();
      this.users.set(userRecord.id, userRecord);

      // Revoke all refresh tokens
      await this.revokeAllRefreshTokens(userRecord.id);

      this.logger.info('Password reset completed', { userId: userRecord.id });
    }, context, 'confirmResetPassword');
  }

  // Helper methods

  private async createDefaultAdminUser(): Promise<void> {
    const adminPassword = await this.hashPassword('admin123');
    
    const adminUser: UserRecord = {
      id: uuidv4(),
      email: 'admin@autoads.dev',
      username: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      password: adminPassword,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emailVerified: true,
      loginAttempts: 0,
      refreshTokens: []
    };

    this.users.set(adminUser.id, adminUser);
    this.emailIndex.set(adminUser.email, adminUser.id);
    this.usernameIndex.set(adminUser.username, adminUser.id);

    this.logger.info('Default admin user created', { 
      userId: adminUser.id, 
      email: adminUser.email 
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.authConfig.bcrypt.saltRounds);
  }

  private async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  private validateRegistrationData(data: RegisterRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.password !== data.confirmPassword) {
      errors.push('Passwords do not match');
    }

    const passwordValidation = this.validatePasswordStrength(data.password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors);
    }

    return { isValid: errors.length === 0, errors };
  }

  private validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const security = this.authConfig.security;

    if (password.length < security.passwordMinLength) {
      errors.push(`Password must be at least ${security.passwordMinLength} characters long`);
    }

    if (password.length > security.passwordMaxLength) {
      errors.push(`Password must be no more than ${security.passwordMaxLength} characters long`);
    }

    if (security.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (security.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (security.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (security.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { isValid: errors.length === 0, errors };
  }

  private sanitizeUser(user: UserRecord): User {
    const { password, loginAttempts, lockoutUntil, refreshTokens, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private async incrementLoginAttempts(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.loginAttempts += 1;
    user.updatedAt = new Date().toISOString();

    // Lock account if max attempts reached
    if (user.loginAttempts >= this.authConfig.security.maxLoginAttempts) {
      user.lockoutUntil = Date.now() + (this.authConfig.security.lockoutDuration * 1000);
      user.status = UserStatus.SUSPENDED;
    }

    this.users.set(userId, user);
  }

  private async resetLoginAttempts(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.loginAttempts = 0;
    user.lockoutUntil = undefined;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
  }

  private async updateLastLogin(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.refreshTokens.push(refreshToken);
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
  }

  private async removeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.refreshTokens = user.refreshTokens.filter((token: any) => token !== refreshToken);
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
  }

  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    // Revoke all refresh tokens
    for (const refreshToken of user.refreshTokens) {
      await this.jwtService.revokeToken(refreshToken, 'Password changed');
    }

    user.refreshTokens = [];
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
  }

  private async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;

    user.password = newPassword;
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
  }
}

export default AuthService;