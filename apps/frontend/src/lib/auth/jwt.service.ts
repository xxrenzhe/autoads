/**
 * JWT Service - Handles JWT token generation, validation, and management
 * Follows security best practices for token handling
 */

import { EnhancedError } from '@/lib/utils/error-handling';
import jwt from 'jsonwebtoken';
import type { Algorithm, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { BaseService, ServiceContext } from '@/lib/core/BaseService';
import { Logger } from '@/lib/core/Logger';
import { 
  JwtPayload, 
  TokenType, 
  AuthConfig, 
  defaultAuthConfig, 
  AuthError, 
  AuthErrorType 
} from '@/types/auth';

export class JWTService extends BaseService {
  protected get authConfig(): AuthConfig {
    return this.config as AuthConfig;
  }

  constructor(config?: Partial<AuthConfig>) {
    const mergedConfig = { ...defaultAuthConfig, ...config };
    super({
      ...mergedConfig,
      name: 'JWTService',
      version: '1.0.0'
    });
  }

  protected override async onInitialize(): Promise<void> {
    this.logger.info('Initializing JWT service');
    
    // Validate JWT configuration
    if (!this.authConfig.jwt.secret || this.authConfig.jwt.secret === 'your-secret-key-change-in-production') {
      this.logger.warn('JWT secret is not properly configured. Using default secret - NOT RECOMMENDED FOR PRODUCTION');
    }

    if (this.authConfig.jwt.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }

    this.logger.info('JWT service initialized successfully');
  }

  protected override async onStart(): Promise<void> {
    this.logger.info('Starting JWT service');
    // Additional startup logic if needed
  }

  protected async onStop(): Promise<void> {
    this.logger.info('Stopping JWT service');
    // Cleanup logic if needed
  }

  protected async onDestroy(): Promise<void> {
    this.logger.info('Destroying JWT service');
    // Cleanup logic if needed
  }

  protected async onHealthCheck(): Promise<unknown> {
    return {
      status: 'healthy',
      service: this.name,
      version: this.version,
      config: {
        algorithm: this.authConfig.jwt.algorithm,
        issuer: this.authConfig.jwt.issuer,
        audience: this.authConfig.jwt.audience,
        accessTokenExpiry: this.authConfig.jwt.accessTokenExpiry,
        refreshTokenExpiry: this.authConfig.jwt.refreshTokenExpiry
      }
    };
  }

  /**
   * Generate access token
   */
  async generateAccessToken(
    userId: string,
    email: string,
    username: string,
    role: string,
    additionalPayload: Record<string, unknown> = {}
  ): Promise<string> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      userId,
      metadata: { operation: 'generateAccessToken', email, username }
    };

    return this.withErrorHandling(async () => {
      const payload: JwtPayload = {
        sub: userId,
        email,
        username,
        role: role as any,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.authConfig.jwt.accessTokenExpiry,
        type: TokenType.ACCESS,
        jti: uuidv4(),
        ...additionalPayload
      };

      const token = jwt.sign(payload, this.authConfig.jwt.secret, {
        algorithm: this.authConfig.jwt.algorithm as Algorithm,
        issuer: this.authConfig.jwt.issuer,
        audience: this.authConfig.jwt.audience,
        jwtid: payload.jti
      });

      this.logger.info('Access token generated successfully', { 
        userId, 
        tokenId: payload.jti,
        expiresAt: payload.exp 
      });

      return token;
    }, context, 'generateAccessToken');
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(
    userId: string,
    email: string,
    username: string,
    role: string,
    sessionId?: string
  ): Promise<string> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      userId,
      metadata: { operation: 'generateRefreshToken', email, username }
    };

    return this.withErrorHandling(async () => {
      const payload: JwtPayload = {
        sub: userId,
        email,
        username,
        role: role as any,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.authConfig.jwt.refreshTokenExpiry,
        type: TokenType.REFRESH,
        jti: uuidv4(),
        sessionId: sessionId || uuidv4()
      };

      const token = jwt.sign(payload, this.authConfig.jwt.secret, {
        algorithm: this.authConfig.jwt.algorithm as Algorithm,
        issuer: this.authConfig.jwt.issuer,
        audience: this.authConfig.jwt.audience,
        jwtid: payload.jti
      });

      this.logger.info('Refresh token generated successfully', { 
        userId, 
        tokenId: payload.jti,
        sessionId: payload.sessionId,
        expiresAt: payload.exp 
      });

      return token;
    }, context, 'generateRefreshToken');
  }

  /**
   * Generate token pair (access + refresh)
   */
  async generateTokenPair(
    userId: string,
    email: string,
    username: string,
    role: string,
    additionalPayload: Record<string, unknown> = {}
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = uuidv4();
    
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, email, username, role, { sessionId, ...additionalPayload }),
      this.generateRefreshToken(userId, email, username, role, sessionId)
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Validate and decode JWT token
   */
  async validateToken(token: string, expectedType?: TokenType): Promise<JwtPayload> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'validateToken', tokenType: expectedType }
    };

    return this.withErrorHandling(async () => {
      try {
        const decoded = jwt.verify(token, this.authConfig.jwt.secret, {
          algorithms: [this.authConfig.jwt.algorithm as Algorithm],
          issuer: this.authConfig.jwt.issuer,
          audience: this.authConfig.jwt.audience
        }) as JwtPayload;

        // Validate token type if specified
        if (expectedType && decoded.type !== expectedType) {
          throw new AuthError(
            AuthErrorType.INVALID_TOKEN,
            `Expected ${expectedType} token but got ${decoded.type}`,
            401
          );
        }

        // Check if token is expired
        if (decoded.exp < Math.floor(Date.now() / 1000)) {
          throw new AuthError(
            AuthErrorType.TOKEN_EXPIRED,
            'Token has expired',
            401
          );
        }

        this.logger.debug('Token validated successfully', { 
          userId: decoded.sub,
          tokenId: decoded.jti,
          type: decoded.type
        });

        return decoded;
      } catch (error) {
        if (error instanceof (jwt as any).JsonWebTokenError) {
          throw new AuthError(
            AuthErrorType.INVALID_TOKEN,
            'Invalid token',
            401,
            { originalError: error.message }
          );
        }
        
        if (error instanceof (jwt as any).TokenExpiredError) {
          throw new AuthError(
            AuthErrorType.TOKEN_EXPIRED,
            'Token has expired',
            401,
            { expiredAt: error.expiredAt }
          );
        }

        if (error instanceof AuthError) {
          throw error;
        }

        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Token validation failed',
          401,
          { originalError: error instanceof Error ? error.message : String(error) }
        );
      }
    }, context, 'validateToken');
  }

  /**
   * Extract token from authorization header
   */
  extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Extract token from cookie
   */
  extractTokenFromCookie(cookieHeader: string | null, cookieName: string = 'token'): string | null {
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').reduce((acc, cookie: any) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);

    return cookies[cookieName] || null;
  }

  /**
   * Decode token without validation (for debugging/logging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      this.logger.warn('Failed to decode token', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): number | null {
    const decoded = this.decodeToken(token);
    return decoded?.exp || null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const exp = this.getTokenExpiration(token);
    if (!exp) {
      return true;
    }
    return exp < Math.floor(Date.now() / 1000);
  }

  /**
   * Get time until token expiration
   */
  getTimeUntilExpiration(token: string): number {
    const exp = this.getTokenExpiration(token);
    if (!exp) {
      return 0;
    }
    return Math.max(0, exp - Math.floor(Date.now() / 1000));
  }

  /**
   * Revoke token (add to blacklist)
   */
  async revokeToken(token: string, reason?: string): Promise<void> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'revokeToken', reason }
    };

    return this.withErrorHandling(async () => {
      const decoded = this.decodeToken(token);
      if (!decoded) {
        throw new AuthError(
          AuthErrorType.INVALID_TOKEN,
          'Cannot revoke invalid token',
          400
        );
      }

      // Add to blacklist with TTL until expiration
      const blacklistKey = `jwt:blacklist:${decoded.jti}`;
      const ttl = this.getTimeUntilExpiration(token);

      if (ttl > 0) {
        await this.cache.set(blacklistKey, {
          revokedAt: Math.floor(Date.now() / 1000),
          reason,
          tokenId: decoded.jti,
          userId: decoded.sub
        }, ttl);

        this.logger.info('Token revoked successfully', { 
          tokenId: decoded.jti,
          userId: decoded.sub,
          reason,
          ttl
        });
      }
    }, context, 'revokeToken');
  }

  /**
   * Check if token is revoked
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.jti) {
      return false;
    }

    const blacklistKey = `jwt:blacklist:${decoded.jti}`;
    const revoked = await this.cache.get(blacklistKey);
    
    return revoked !== null;
  }

  /**
   * Clean up expired tokens from blacklist
   */
  async cleanupExpiredTokens(): Promise<number> {
    const context: ServiceContext = {
      requestId: uuidv4(),
      metadata: { operation: 'cleanupExpiredTokens' }
    };

    return this.withErrorHandling(async () => {
      // This would typically be implemented with a proper cache system
      // that supports key pattern matching or TTL-based cleanup
      this.logger.info('Expired token cleanup completed');
      return 0;
    }, context, 'cleanupExpiredTokens');
  }

  /**
   * Get token metadata
   */
  getTokenMetadata(token: string): {
    isValid: boolean;
    isExpired: boolean;
    isRevoked: boolean;
    timeUntilExpiration: number;
    decoded: JwtPayload | null;
  } {
    const decoded = this.decodeToken(token);
    
    return {
      isValid: decoded !== null,
      isExpired: this.isTokenExpired(token),
      isRevoked: false, // Would need async check
      timeUntilExpiration: this.getTimeUntilExpiration(token),
      decoded
    };
  }

  /**
   * Generate secure random token ID
   */
  generateTokenId(): string {
    return uuidv4();
  }

  /**
   * Get configuration
   */
  getConfig(): AuthConfig {
    return { ...this.authConfig };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AuthConfig>): void {
    // Configuration is immutable after initialization
    this.logger.warn('JWT configuration update not supported after initialization');
  }
}

export default JWTService;
