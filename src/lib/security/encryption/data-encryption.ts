import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHash } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export interface EncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  saltLength: number
  iterations: number
}

export interface EncryptedData {
  data: string
  iv: string
  salt: string
  algorithm: string
}

export class DataEncryption {
  private config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 16,
    iterations: 100000
  }

  private masterKey: string

  constructor() {
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY || this.generateMasterKey()
    
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      console.warn('ENCRYPTION_MASTER_KEY not set. Using generated key. This should not be used in production.')
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(data: string, customKey?: string): Promise<string> {
    try {
      const key = customKey || this.masterKey
      const salt = randomBytes(this.config.saltLength)
      const iv = randomBytes(this.config.ivLength)
      
      // Derive key from master key and salt
      const derivedKey = await scryptAsync(key, salt, this.config.keyLength) as Buffer
      
      // Create cipher with IV
      const cipher = createCipheriv(this.config.algorithm, derivedKey, iv)
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      // Get auth tag for GCM mode
      const authTag = (cipher as any).getAuthTag ? (cipher as any).getAuthTag() : Buffer.alloc(0)
      
      const encryptedData: EncryptedData = {
        data: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        algorithm: this.config.algorithm
      }
      
      // Include auth tag if available
      if (authTag.length > 0) {
        (encryptedData as any).authTag = authTag.toString('hex')
      }
      
      return Buffer.from(JSON.stringify(encryptedData)).toString('base64')
    } catch (error) {
      console.error('Encryption error:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(encryptedData: string, customKey?: string): Promise<string> {
    try {
      const key = customKey || this.masterKey
      const data: EncryptedData = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'))
      
      const salt = Buffer.from(data.salt, 'hex')
      const iv = Buffer.from(data.iv, 'hex')
      
      // Derive key from master key and salt
      const derivedKey = await scryptAsync(key, salt, this.config.keyLength) as Buffer
      
      // Create decipher with IV
      const decipher = createDecipheriv(data.algorithm, derivedKey, iv)
      
      // Set auth tag if available (for GCM mode)
      if ((data as any).authTag && (decipher as any).setAuthTag) {
        const authTag = Buffer.from((data as any).authTag, 'hex')
        ;(decipher as any).setAuthTag(authTag)
      }
      
      // Decrypt data
      let decrypted = decipher.update(data.data, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('Decryption error:', error)
      throw new Error('Failed to decrypt data')
    }
  }

  /**
   * Encrypt object
   */
  async encryptObject(obj: any, customKey?: string): Promise<string> {
    const jsonString = JSON.stringify(obj)
    return await this.encrypt(jsonString, customKey)
  }

  /**
   * Decrypt object
   */
  async decryptObject<T = any>(encryptedData: string, customKey?: string): Promise<T> {
    const jsonString = await this.decrypt(encryptedData, customKey)
    return JSON.parse(jsonString)
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string, salt?: string): string {
    const actualSalt = salt || randomBytes(16).toString('hex')
    const hash = createHash('sha256')
    hash.update(data + actualSalt)
    return hash.digest('hex') + ':' + actualSalt
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hashedData: string): boolean {
    try {
      const [hash, salt] = hashedData.split(':')
      const newHash = this.hash(data, salt).split(':')[0]
      return hash === newHash
    } catch (error) {
      return false
    }
  }

  /**
   * Generate secure random key
   */
  generateSecureKey(length: number = 32): string {
    return randomBytes(length).toString('hex')
  }

  /**
   * Generate master key
   */
  private generateMasterKey(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Encrypt database field
   */
  async encryptField(value: string, fieldName: string): Promise<string> {
    // Use field-specific key derivation
    const fieldKey = createHash('sha256').update(this.masterKey + fieldName).digest('hex')
    return await this.encrypt(value, fieldKey)
  }

  /**
   * Decrypt database field
   */
  async decryptField(encryptedValue: string, fieldName: string): Promise<string> {
    // Use field-specific key derivation
    const fieldKey = createHash('sha256').update(this.masterKey + fieldName).digest('hex')
    return await this.decrypt(encryptedValue, fieldKey)
  }

  /**
   * Encrypt sensitive configuration
   */
  async encryptConfig(config: Record<string, any>): Promise<Record<string, string>> {
    const encrypted: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(config)) {
      if (this.isSensitiveField(key)) {
        encrypted[key] = await this.encryptField(String(value), key)
      } else {
        encrypted[key] = String(value)
      }
    }
    
    return encrypted
  }

  /**
   * Decrypt sensitive configuration
   */
  async decryptConfig(encryptedConfig: Record<string, string>): Promise<Record<string, any>> {
    const decrypted: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(encryptedConfig)) {
      if (this.isSensitiveField(key)) {
        try {
          decrypted[key] = await this.decryptField(value, key)
        } catch (error) {
          console.error(`Failed to decrypt field ${key}:`, error)
          decrypted[key] = null
        }
      } else {
        decrypted[key] = value
      }
    }
    
    return decrypted
  }

  /**
   * Check if field contains sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /credential/i,
      /api_key/i,
      /private/i,
      /auth/i
    ]
    
    return sensitivePatterns.some(pattern => pattern.test(fieldName))
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(newKey: string): Promise<void> {
    // This would be used to re-encrypt all data with a new key
    // Implementation would depend on specific requirements
    console.warn('Key rotation not implemented. This should be done carefully in production.')
  }

  /**
   * Secure delete (overwrite memory)
   */
  secureDelete(data: string): void {
    // In JavaScript, we can't truly overwrite memory, but we can try to minimize exposure
    if (typeof data === 'string') {
      // Create a new string with random data of the same length
      const randomData = randomBytes(data.length).toString('hex').substring(0, data.length)
      // This doesn't actually overwrite the original string in memory, but it's the best we can do
      data = randomData
    }
  }
}

export const dataEncryption = new DataEncryption()