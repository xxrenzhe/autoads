import * as crypto from 'crypto'

interface EncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  tagLength: number
  saltLength: number
  iterations: number
}

interface EncryptedData {
  encrypted: string
  iv: string
  tag?: string
  salt?: string
}

interface MaskingOptions {
  maskChar: string
  visibleStart: number
  visibleEnd: number
  minLength: number
}

class EncryptionService {
  private config: EncryptionConfig
  private masterKey: Buffer

  constructor(masterKey?: string) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16,  // 128 bits
      tagLength: 16, // 128 bits
      saltLength: 32, // 256 bits
      iterations: 100000 // PBKDF2 iterations
    }

    // Use provided key or generate from environment
    const keySource = masterKey || process.env.ENCRYPTION_MASTER_KEY || 'default-dev-key-change-in-production'
    this.masterKey = this.deriveKey(keySource)
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string, additionalData?: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(this.config.ivLength)
      const cipher = crypto.createCipheriv(this.config.algorithm, this.masterKey, iv) as crypto.CipherGCM
      
      if (additionalData) {
        cipher.setAAD(Buffer.from(additionalData, 'utf8'))
      }

      let encrypted = cipher.update(plaintext, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      const tag = cipher.getAuthTag()

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      }
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: EncryptedData, additionalData?: string): string {
    try {
      const { encrypted, iv, tag } = encryptedData

      if (!iv || !tag) {
        throw new Error('Missing required encryption metadata')
      }

      const decipher = crypto.createDecipheriv(this.config.algorithm, this.masterKey, Buffer.from(iv, 'hex')) as crypto.DecipherGCM
      decipher.setAuthTag(Buffer.from(tag, 'hex'))

      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData, 'utf8'))
      }

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Hash password with salt
   */
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    try {
      const actualSalt = salt || crypto.randomBytes(this.config.saltLength).toString('hex')
      const hash = crypto.pbkdf2Sync(
        password,
        actualSalt,
        this.config.iterations,
        this.config.keyLength,
        'sha512'
      ).toString('hex')

      return { hash, salt: actualSalt }
    } catch (error) {
      throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const { hash: computedHash } = this.hashPassword(password, salt)
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'))
    } catch (error) {
      return false
    }
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Generate API key
   */
  generateApiKey(prefix: string = 'ak'): string {
    const timestamp = Date.now().toString(36)
    const random = crypto.randomBytes(16).toString('hex')
    return `${prefix}_${timestamp}_${random}`
  }

  /**
   * Mask sensitive data for display
   */
  maskSensitiveData(data: string, options: Partial<MaskingOptions> = {}): string {
    const opts: MaskingOptions = {
      maskChar: '*',
      visibleStart: 2,
      visibleEnd: 2,
      minLength: 6,
      ...options
    }

    if (!data || data.length < opts.minLength) {
      return opts.maskChar.repeat(opts.minLength)
    }

    const start = data.substring(0, opts.visibleStart)
    const end = data.substring(data.length - opts.visibleEnd)
    const maskLength = Math.max(0, data.length - opts.visibleStart - opts.visibleEnd)
    const mask = opts.maskChar.repeat(maskLength)

    return start + mask + end
  }

  /**
   * Encrypt API keys and sensitive configuration
   */
  encryptApiKey(apiKey: string): string {
    const encrypted = this.encrypt(apiKey, 'api-key')
    return Buffer.from(JSON.stringify(encrypted)).toString('base64')
  }

  /**
   * Decrypt API keys and sensitive configuration
   */
  decryptApiKey(encryptedApiKey: string): string {
    try {
      const encryptedData = JSON.parse(Buffer.from(encryptedApiKey, 'base64').toString('utf8'))
      return this.decrypt(encryptedData, 'api-key')
    } catch (error) {
      throw new Error('Invalid encrypted API key format')
    }
  }

  /**
   * Create data integrity hash
   */
  createIntegrityHash(data: any): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data)
    return crypto.createHmac('sha256', this.masterKey).update(serialized).digest('hex')
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(data: any, expectedHash: string): boolean {
    try {
      const computedHash = this.createIntegrityHash(data)
      return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(computedHash, 'hex'))
    } catch (error) {
      return false
    }
  }

  /**
   * Encrypt database field
   */
  encryptField(value: string, fieldName: string): string {
    if (!value) return value
    
    try {
      const encrypted = this.encrypt(value, fieldName)
      return JSON.stringify(encrypted)
    } catch (error) {
      console.error(`Failed to encrypt field ${fieldName}:`, error)
      throw error
    }
  }

  /**
   * Decrypt database field
   */
  decryptField(encryptedValue: string, fieldName: string): string {
    if (!encryptedValue) return encryptedValue
    
    try {
      const encryptedData = JSON.parse(encryptedValue)
      return this.decrypt(encryptedData, fieldName)
    } catch (error) {
      console.error(`Failed to decrypt field ${fieldName}:`, error)
      throw error
    }
  }

  /**
   * Secure data deletion (overwrite memory)
   */
  secureDelete(data: Buffer | string): void {
    if (Buffer.isBuffer(data)) {
      data.fill(0)
    }
    // Note: For strings, we can't actually overwrite memory in JavaScript
    // This is more of a placeholder for the concept
  }

  /**
   * Generate encryption key from master key
   */
  private deriveKey(keySource: string): Buffer {
    // Use a fixed salt for key derivation (in production, this should be configurable)
    const salt = 'admin-system-encryption-salt'
    return crypto.pbkdf2Sync(keySource, salt, this.config.iterations, this.config.keyLength, 'sha512')
  }

  /**
   * Rotate encryption keys (for key rotation strategy)
   */
  rotateKey(newMasterKey: string): EncryptionService {
    return new EncryptionService(newMasterKey)
  }

  /**
   * Get encryption metadata
   */
  getEncryptionInfo(): {
    algorithm: string
    keyLength: number
    ivLength: number
    tagLength: number
  } {
    return {
      algorithm: this.config.algorithm,
      keyLength: this.config.keyLength,
      ivLength: this.config.ivLength,
      tagLength: this.config.tagLength
    }
  }
}

// Singleton instance
let encryptionService: EncryptionService | null = null

export function getEncryptionService(): EncryptionService {
  if (!encryptionService) {
    encryptionService = new EncryptionService()
  }
  return encryptionService
}

// Utility functions for common operations
export function encryptSensitiveData(data: string): string {
  return getEncryptionService().encryptField(data, 'sensitive')
}

export function decryptSensitiveData(encryptedData: string): string {
  return getEncryptionService().decryptField(encryptedData, 'sensitive')
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  
  const [localPart, domain] = email.split('@')
  const maskedLocal = getEncryptionService().maskSensitiveData(localPart, {
    visibleStart: 1,
    visibleEnd: 1,
    minLength: 3
  })
  
  return `${maskedLocal}@${domain}`
}

export function maskPhoneNumber(phone: string): string {
  return getEncryptionService().maskSensitiveData(phone, {
    visibleStart: 3,
    visibleEnd: 2,
    minLength: 8
  })
}

export function maskCreditCard(cardNumber: string): string {
  return getEncryptionService().maskSensitiveData(cardNumber.replace(/\s/g, ''), {
    visibleStart: 0,
    visibleEnd: 4,
    minLength: 12
  })
}

export { EncryptionService }
export type { EncryptedData, MaskingOptions }