import bcrypt from 'bcryptjs'

/**
 * Password Policy Management
 * 
 * Simplified password policy service using default values only
 * since SecurityPolicy model doesn't exist in database schema
 */

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumbers: boolean
  requireSpecialChars: boolean
  historyCount: number
  maxLoginAttempts: number
  lockoutDuration: number // minutes
  passwordExpiry?: number // days
  preventCommonPasswords: boolean
}

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong'
  score: number
}

export interface LoginAttemptResult {
  success: boolean
  isLocked: boolean
  remainingAttempts?: number
  lockoutExpiresAt?: Date
  requiresPasswordReset?: boolean
}

export class PasswordPolicyManager {
  private static readonly DEFAULT_POLICY: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    historyCount: 5,
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    passwordExpiry: 90,
    preventCommonPasswords: true
  }

  private static readonly COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
    'qwerty123', 'admin123', 'root', 'toor', 'pass', 'test', 'guest'
  ]

  private static readonly SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?'

  /**
   * Get current password policy (always returns default)
   */
  static async getPasswordPolicy(): Promise<PasswordPolicy> {
    return this.DEFAULT_POLICY
  }

  /**
   * Update password policy (not implemented - no database model)
   */
  static async updatePasswordPolicy(
    policy: Partial<PasswordPolicy>,
    updatedBy: string
  ): Promise<boolean> {
    console.warn('Password policy update not implemented - no SecurityPolicy model in database')
    return false
  }

  /**
   * Validate password against policy
   */
  static validatePassword(password: string, policy: PasswordPolicy = this.DEFAULT_POLICY): PasswordValidationResult {
    const errors: string[] = []
    let score = 0

    // Length check
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`)
    } else {
      score += Math.min(password.length * 4, 25)
    }

    // Character variety checks
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChars = new RegExp(`[${this.SPECIAL_CHARS.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]`).test(password)

    if (policy.requireUppercase && !hasUppercase) {
      errors.push('Password must contain at least one uppercase letter')
    } else if (hasUppercase) {
      score += 10
    }

    if (policy.requireLowercase && !hasLowercase) {
      errors.push('Password must contain at least one lowercase letter')
    } else if (hasLowercase) {
      score += 10
    }

    if (policy.requireNumbers && !hasNumbers) {
      errors.push('Password must contain at least one number')
    } else if (hasNumbers) {
      score += 10
    }

    if (policy.requireSpecialChars && !hasSpecialChars) {
      errors.push('Password must contain at least one special character')
    } else if (hasSpecialChars) {
      score += 15
    }

    // Common password check
    if (policy.preventCommonPasswords && this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      errors.push('Password is too common')
      score -= 20
    }

    // Calculate strength
    let strength: PasswordValidationResult['strength'] = 'weak'
    if (score >= 80) strength = 'very_strong'
    else if (score >= 60) strength = 'strong'
    else if (score >= 40) strength = 'good'
    else if (score >= 25) strength = 'fair'

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.max(0, score)
    }
  }

  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  /**
   * Check if password needs to be rehashed
   */
  static async needsRehash(hash: string): Promise<boolean> {
    try {
      // Extract rounds from hash (format: $2b$rounds.salt...)
      const rounds = parseInt(hash.split('$')[2], 10)
      return rounds < 12
    } catch {
      return true
    }
  }

  /**
   * Generate secure random password
   */
  static generatePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const special = this.SPECIAL_CHARS

    let password = ''
    
    // Ensure at least one of each required type
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]

    // Fill remaining length with random characters from all sets
    const allChars = lowercase + uppercase + numbers + special
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  /**
   * Record login attempt (simplified - no tracking model)
   */
  static async recordLoginAttempt(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginAttemptResult> {
    // Simplified implementation - no tracking model
    return {
      success,
      isLocked: false
    }
  }

  /**
   * Check if account is locked (simplified - always false)
   */
  static async isAccountLocked(userId: string): Promise<boolean> {
    // No account lockout model - always return false
    return false
  }

  /**
   * Unlock account (not implemented)
   */
  static async unlockAccount(userId: string): Promise<boolean> {
    console.warn('Account unlock not implemented - no lockout model in database')
    return false
  }

  /**
   * Get password strength indicator
   */
  static getPasswordStrength(password: string): {
    strength: PasswordValidationResult['strength']
    score: number
    suggestions: string[]
  } {
    const result = this.validatePassword(password)
    const suggestions: string[] = []

    if (result.errors.length > 0) {
      suggestions.push(...result.errors)
    } else {
      if (password.length < 12) suggestions.push('Use a longer password for better security')
      if (!/[A-Z]/.test(password)) suggestions.push('Add uppercase letters')
      if (!/[a-z]/.test(password)) suggestions.push('Add lowercase letters')
      if (!/\d/.test(password)) suggestions.push('Add numbers')
      if (!new RegExp(`[${this.SPECIAL_CHARS.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]`).test(password)) {
        suggestions.push('Add special characters')
      }
    }

    return {
      strength: result.strength,
      score: result.score,
      suggestions
    }
  }
}