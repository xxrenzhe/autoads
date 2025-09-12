import { getEncryptionService } from './encryption-service'

interface MaskingRule {
  field: string
  type: 'email' | 'phone' | 'credit_card' | 'ssn' | 'custom'
  maskChar?: string
  visibleStart?: number
  visibleEnd?: number
  customMasker?: (value: string) => string
}

interface DataMaskingOptions {
  rules: MaskingRule[]
  preserveStructure: boolean
  maskNullValues: boolean
}

class DataMaskingService {
  private encryptionService = getEncryptionService()

  /**
   * Mask sensitive data in objects
   */
  maskObject(data: any, options: DataMaskingOptions): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    if (Array.isArray(data)) {
      return data?.filter(Boolean)?.map(item => this.maskObject(item, options))
    }

    const masked = { ...data }

    for (const rule of options.rules) {
      if (rule.field in masked) {
        const value = masked[rule.field]
        
        if (value === null || value === undefined) {
          if (options.maskNullValues) {
            masked[rule.field] = '***'
          }
          continue
        }

        masked[rule.field] = this.maskValue(String(value), rule)
      }
    }

    return masked
  }

  /**
   * Mask individual values based on type
   */
  maskValue(value: string, rule: MaskingRule): string {
    if (!value) return value

    switch (rule.type) {
      case 'email':
        return this.maskEmail(value)
      
      case 'phone':
        return this.maskPhone(value)
      
      case 'credit_card':
        return this.maskCreditCard(value)
      
      case 'ssn':
        return this.maskSSN(value)
      
      case 'custom':
        return rule.customMasker ? rule.customMasker(value) : value
      
      default:
        return this.maskGeneric(value, rule)
    }
  }

  /**
   * Mask email addresses
   */
  private maskEmail(email: string): string {
    if (!email.includes('@')) return email

    const [localPart, domain] = email.split('@')
    
    if (localPart.length <= 2) {
      return `**@${domain}`
    }

    const maskedLocal = localPart.charAt(0) + 
                       '*'.repeat(Math.max(0, localPart.length - 2)) + 
                       localPart.charAt(localPart.length - 1)
    
    return `${maskedLocal}@${domain}`
  }

  /**
   * Mask phone numbers
   */
  private maskPhone(phone: string): string {
    // Remove all non-digit characters for processing
    const digits = phone.replace(/\D/g, '')
    
    if (digits.length < 7) {
      return '*'.repeat(phone.length)
    }

    // Keep first 3 and last 2 digits visible
    const masked = digits.substring(0, 3) + 
                  '*'.repeat(Math.max(0, digits.length - 5)) + 
                  digits.substring(digits.length - 2)
    
    // Preserve original formatting if possible
    if (phone.includes('(') && phone.includes(')')) {
      return `(${masked.substring(0, 3)}) ${masked.substring(3, 6)}-${masked.substring(6)}`
    } else if (phone.includes('-')) {
      return masked.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
    }
    
    return masked
  }

  /**
   * Mask credit card numbers
   */
  private maskCreditCard(cardNumber: string): string {
    const digits = cardNumber.replace(/\D/g, '')
    
    if (digits.length < 12) {
      return '*'.repeat(cardNumber.length)
    }

    // Show only last 4 digits
    const masked = '*'.repeat(digits.length - 4) + digits.substring(digits.length - 4)
    
    // Preserve spacing if present
    if (cardNumber.includes(' ')) {
      return masked.replace(/(\d{4})/g, '$1 ').trim()
    }
    
    return masked
  }

  /**
   * Mask Social Security Numbers
   */
  private maskSSN(ssn: string): string {
    const digits = ssn.replace(/\D/g, '')
    
    if (digits.length !== 9) {
      return '*'.repeat(ssn.length)
    }

    // Show only last 4 digits: ***-**-1234
    const masked = '***-**-' + digits.substring(5)
    return masked
  }

  /**
   * Generic masking with custom rules
   */
  private maskGeneric(value: string, rule: MaskingRule): string {
    const maskChar = rule.maskChar || '*'
    const visibleStart = rule.visibleStart || 0
    const visibleEnd = rule.visibleEnd || 0

    if (value.length <= visibleStart + visibleEnd) {
      return maskChar.repeat(value.length)
    }

    const start = value.substring(0, visibleStart)
    const end = value.substring(value.length - visibleEnd)
    const maskLength = value.length - visibleStart - visibleEnd
    const mask = maskChar.repeat(maskLength)

    return start + mask + end
  }

  /**
   * Create masking rules for common user data
   */
  createUserDataMaskingRules(): MaskingRule[] {
    return [
      { field: 'email', type: 'email' },
      { field: 'phone', type: 'phone' },
      { field: 'phoneNumber', type: 'phone' },
      { field: 'creditCard', type: 'credit_card' },
      { field: 'cardNumber', type: 'credit_card' },
      { field: 'ssn', type: 'ssn' },
      { field: 'socialSecurityNumber', type: 'ssn' },
      { 
        field: 'apiKey', 
        type: 'custom',
        customMasker: (value: string) => {
          if (value.includes('_')) {
            const parts = value.split('_')
            return parts[0] + '_' + '*'.repeat(8) + '_' + parts[parts.length - 1].substring(0, 4) + '***'
          }
          return this.maskGeneric(value, { field: 'apiKey', type: 'custom', visibleStart: 4, visibleEnd: 4 })
        }
      },
      {
        field: 'password',
        type: 'custom',
        customMasker: () => '********'
      },
      {
        field: 'token',
        type: 'custom',
        customMasker: (value: string) => this.maskGeneric(value, { 
          field: 'token', 
          type: 'custom', 
          visibleStart: 8, 
          visibleEnd: 8 
        })
      }
    ]
  }

  /**
   * Mask user data for API responses
   */
  maskUserData(userData: any): any {
    const rules = this.createUserDataMaskingRules()
    return this.maskObject(userData, {
      rules,
      preserveStructure: true,
      maskNullValues: false
    })
  }

  /**
   * Mask data for audit logs
   */
  maskAuditData(auditData: any): any {
    const rules: MaskingRule[] = [
      ...this.createUserDataMaskingRules(),
      {
        field: 'ipAddress',
        type: 'custom',
        customMasker: (ip: string) => {
          const parts = ip.split('.')
          if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.***.***`
          }
          return this.maskGeneric(ip, { field: 'ipAddress', type: 'custom', visibleStart: 3, visibleEnd: 0 })
        }
      },
      {
        field: 'userAgent',
        type: 'custom',
        customMasker: (ua: string) => {
          // Keep browser name but mask version details
          const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)
          if (browserMatch) {
            return browserMatch[1] + '/***'
          }
          return this.maskGeneric(ua, { field: 'userAgent', type: 'custom', visibleStart: 10, visibleEnd: 0 })
        }
      }
    ]

    return this.maskObject(auditData, {
      rules,
      preserveStructure: true,
      maskNullValues: false
    })
  }

  /**
   * Mask configuration data
   */
  maskConfigData(configData: any): any {
    const rules: MaskingRule[] = [
      {
        field: 'password',
        type: 'custom',
        customMasker: () => '********'
      },
      {
        field: 'secret',
        type: 'custom',
        customMasker: () => '********'
      },
      {
        field: 'key',
        type: 'custom',
        customMasker: (value: string) => this.maskGeneric(value, { 
          field: 'key', 
          type: 'custom', 
          visibleStart: 4, 
          visibleEnd: 4 
        })
      },
      {
        field: 'token',
        type: 'custom',
        customMasker: (value: string) => this.maskGeneric(value, { 
          field: 'token', 
          type: 'custom', 
          visibleStart: 6, 
          visibleEnd: 6 
        })
      },
      {
        field: 'connectionString',
        type: 'custom',
        customMasker: (value: string) => {
          // Mask passwords in connection strings
          return value.replace(/(password|pwd)=([^;]+)/gi, '$1=***')
        }
      }
    ]

    return this.maskObject(configData, {
      rules,
      preserveStructure: true,
      maskNullValues: false
    })
  }

  /**
   * Check if a field should be masked
   */
  shouldMaskField(fieldName: string, value: any): boolean {
    const sensitiveFields = [
      'password', 'secret', 'key', 'token', 'apikey', 'api_key',
      'email', 'phone', 'ssn', 'creditcard', 'credit_card',
      'cardnumber', 'card_number', 'cvv', 'pin'
    ]

    const fieldLower = fieldName.toLowerCase()
    return sensitiveFields.some(sensitive => fieldLower.includes(sensitive))
  }

  /**
   * Auto-mask object based on field names
   */
  autoMaskObject(data: any): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    if (Array.isArray(data)) {
      return data?.filter(Boolean)?.map(item => this.autoMaskObject(item))
    }

    const masked = { ...data }

    for (const [key, value] of Object.entries(masked)) {
      if (this.shouldMaskField(key, value) && typeof value === 'string') {
        if (key.toLowerCase().includes('email')) {
          masked[key] = this.maskEmail(value)
        } else if (key.toLowerCase().includes('phone')) {
          masked[key] = this.maskPhone(value)
        } else if (key.toLowerCase().includes('card')) {
          masked[key] = this.maskCreditCard(value)
        } else if (key.toLowerCase().includes('ssn')) {
          masked[key] = this.maskSSN(value)
        } else {
          masked[key] = this.maskGeneric(value, { 
            field: key, 
            type: 'custom', 
            visibleStart: 2, 
            visibleEnd: 2 
          })
        }
      } else if (typeof value === 'object') {
        masked[key] = this.autoMaskObject(value)
      }
    }

    return masked
  }

  /**
   * Validate masking rules
   */
  validateMaskingRules(rules: MaskingRule[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const rule of rules) {
      if (!rule.field) {
        errors.push('Rule missing field name')
      }

      if (!rule.type) {
        errors.push(`Rule for field '${rule.field}' missing type`)
      }

      if (rule.type === 'custom' && !rule.customMasker) {
        errors.push(`Custom rule for field '${rule.field}' missing customMasker function`)
      }

      if (rule.visibleStart && rule.visibleStart < 0) {
        errors.push(`Rule for field '${rule.field}' has invalid visibleStart value`)
      }

      if (rule.visibleEnd && rule.visibleEnd < 0) {
        errors.push(`Rule for field '${rule.field}' has invalid visibleEnd value`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Singleton instance
let dataMaskingService: DataMaskingService | null = null

export function getDataMaskingService(): DataMaskingService {
  if (!dataMaskingService) {
    dataMaskingService = new DataMaskingService()
  }
  return dataMaskingService
}

// Utility functions
export function maskUserForApi(userData: any): any {
  return getDataMaskingService().maskUserData(userData)
}

export function maskForAuditLog(data: any): any {
  return getDataMaskingService().maskAuditData(data)
}

export function autoMask(data: any): any {
  return getDataMaskingService().autoMaskObject(data)
}

export { DataMaskingService }
export type { MaskingRule, DataMaskingOptions }