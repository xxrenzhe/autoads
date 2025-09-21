/**
 * Unified authentication error handling
 */

export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(
    type: 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'ACCOUNT_LOCKED' | 'EMAIL_EXISTS' | 'REGISTRATION_FAILED',
    message?: string,
    statusCode?: number
  ) {
    super(message || AuthError.getDefaultMessage(type));
    this.code = type;
    this.statusCode = statusCode || AuthError.getDefaultStatusCode(type);
    this.name = 'AuthError';
  }

  private static getDefaultMessage(type: string): string {
    switch (type) {
      case 'INVALID_CREDENTIALS':
        return 'Invalid email or password';
      case 'USER_NOT_FOUND':
        return 'User not found';
      case 'ACCOUNT_LOCKED':
        return 'Account is locked or inactive';
      case 'EMAIL_EXISTS':
        return 'Email already exists';
      case 'REGISTRATION_FAILED':
        return 'Registration failed';
      default:
        return 'Authentication error';
    }
  }

  private static getDefaultStatusCode(type: string): number {
    switch (type) {
      case 'INVALID_CREDENTIALS':
      case 'USER_NOT_FOUND':
        return 401;
      case 'ACCOUNT_LOCKED':
        return 403;
      case 'EMAIL_EXISTS':
        return 409;
      case 'REGISTRATION_FAILED':
        return 500;
      default:
        return 400;
    }
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode
    };
  }
}

/**
 * Handle authentication errors consistently
 */
export function handleAuthError(error: unknown): { error: string; message: string; statusCode: number } {
  if (error instanceof AuthError) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      error: 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: 500
    };
  }

  return {
    error: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    statusCode: 500
  };
}