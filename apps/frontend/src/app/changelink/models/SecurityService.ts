/**
 * Security Service for ChangeLink
 * Provides encryption, decryption, and security utilities
 */

export class SecurityService {
  private readonly ENCRYPTION_KEY = 'change-link-security-key-2024'; // In production, this should be from environment variables
  
  /**
   * Encrypt data using simple encryption
   * Note: In production, use a proper encryption library like crypto-js
   */
  encryptData(data: string): string {
    try {
      // Simple base64 encoding for demo purposes
      // In production, use proper encryption like AES
      const encoded = btoa(data);
      // Add a simple obfuscation layer
      return encoded.split('').reverse().join('');
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using simple decryption
   */
  decryptData(encryptedData: string): string {
    try {
      // Reverse the obfuscation
      const reversed = encryptedData.split('').reverse().join('');
      // Decode base64
      return atob(reversed);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash data using simple hash function
   */
  hashData(data: string): string {
    // Simple hash function for demo purposes
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate data integrity
   */
  validateDataIntegrity(data: string, expectedHash: string): boolean {
    const actualHash = this.hashData(data);
    return actualHash === expectedHash;
  }

  /**
   * Sanitize input to prevent XSS attacks
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint32Array(length);
    
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randomValues);
    } else {
      // Fallback for server-side
      for (let i = 0; i < length; i++) {
        randomValues[i] = Math.floor(Math.random() * chars.length);
      }
    }
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    
    return result;
  }

  /**
   * Check if string contains potentially malicious content
   */
  isMalicious(input: string): boolean {
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /data:text\/html/i
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Securely compare two strings to prevent timing attacks
   */
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}