/**
 * Secure Storage Utilities for ChangeLink
 * Provides encrypted local storage for sensitive data
 */

export class SecureStorage {
  private static readonly ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'change-link-secure-key-2024';
  private static readonly SALT_PREFIX = 'cl-salt-';

  /**
   * Encrypt data using a simple encryption method
   * Note: In production, consider using a proper encryption library
   */
  private static encrypt(data: string): string {
    try {
      // Use the Web Crypto API if available
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        // For production, implement proper AES encryption here
        // For now, using a simple obfuscation method
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(data);
        const keyBytes = encoder.encode(this.ENCRYPTION_KEY);
        
        // Simple XOR encryption (for demo purposes)
        const encrypted = new Uint8Array(dataBytes.length);
        for (let i = 0; i < dataBytes.length; i++) {
          encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
        }
        
        return btoa(String.fromCharCode(...encrypted));
      } else {
        // Fallback for server-side or older browsers
        const encoded = btoa(data);
        return encoded.split('').reverse().join('');
      }
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   */
  private static decrypt(encryptedData: string): string {
    try {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        // Use the Web Crypto API if available
        const encryptedBytes = new Uint8Array(
          atob(encryptedData)
            .split('')
            ?.filter(Boolean)?.map((char: any) => char.charCodeAt(0))
        );
        
        const keyBytes = new TextEncoder().encode(this.ENCRYPTION_KEY);
        
        // Simple XOR decryption
        const decrypted = new Uint8Array(encryptedBytes.length);
        for (let i = 0; i < encryptedBytes.length; i++) {
          decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
        }
        
        return new TextDecoder().decode(decrypted);
      } else {
        // Fallback
        const reversed = encryptedData.split('').reverse().join('');
        return atob(reversed);
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Store sensitive data securely
   */
  static setSecureItem(key: string, value: any): void {
    try {
      const saltedKey = this.SALT_PREFIX + key;
      const serialized = JSON.stringify(value);
      const encrypted = this.encrypt(serialized);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(saltedKey, encrypted);
      }
    } catch (error) {
      console.error('Failed to store secure item:', error);
      throw new Error('Failed to store data securely');
    }
  }

  /**
   * Retrieve sensitive data securely
   */
  static getSecureItem<T>(key: string): T | null {
    try {
      const saltedKey = this.SALT_PREFIX + key;
      
      if (typeof window === 'undefined') {
        return null as any;
      }
      
      const encrypted = localStorage.getItem(saltedKey);
      if (!encrypted) {
        return null as any;
      }
      
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.error('Failed to retrieve secure item:', error);
      return null as any;
    }
  }

  /**
   * Remove secure item
   */
  static removeSecureItem(key: string): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.SALT_PREFIX + key);
    }
  }

  /**
   * Clear all secure storage
   */
  static clearSecureStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const keys = Object.keys(localStorage);
    keys.forEach((key: any) => {
      if (key.startsWith(this.SALT_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Check if secure storage is available
   */
  static isSecureStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined') {
        return false;
      }
      
      const testKey = this.SALT_PREFIX + 'test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Setup-specific secure storage helpers
 */
export class SetupSecureStorage {
  private static readonly SETUP_PROGRESS_KEY = 'setup-progress';
  private static readonly GOOGLE_ADS_CONFIG_KEY = 'google-ads-config';
  private static readonly EMAIL_CONFIG_KEY = 'email-config';

  /**
   * Save setup progress securely
   */
  static saveSetupProgress(progress: {
    currentStep: number;
    completedSteps: string[];
    googleAdsConfig?: any;
    emailConfig?: any;
  }): void {
    try {
      SecureStorage.setSecureItem(this.SETUP_PROGRESS_KEY, progress);
    } catch (error) {
      console.error('Failed to save setup progress:', error);
    }
  }

  /**
   * Load setup progress
   */
  static loadSetupProgress(): {
    currentStep: number;
    completedSteps: string[];
    googleAdsConfig?: any;
    emailConfig?: any;
  } | null {
    return SecureStorage.getSecureItem(this.SETUP_PROGRESS_KEY);
  }

  /**
   * Save Google Ads configuration securely
   */
  static saveGoogleAdsConfig(config: any): void {
    try {
      // Only store sensitive fields securely
      const sensitiveConfig = {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        developerToken: config.developerToken,
        refreshToken: config.refreshToken
      };
      SecureStorage.setSecureItem(this.GOOGLE_ADS_CONFIG_KEY, sensitiveConfig);
    } catch (error) {
      console.error('Failed to save Google Ads config:', error);
    }
  }

  /**
   * Load Google Ads configuration
   */
  static loadGoogleAdsConfig(): any {
    return SecureStorage.getSecureItem(this.GOOGLE_ADS_CONFIG_KEY);
  }

  /**
   * Save email configuration securely
   */
  static saveEmailConfig(config: any): void {
    try {
      const sensitiveConfig = {
        smtpPassword: config.smtpPassword,
        smtpUser: config.smtpUser
      };
      SecureStorage.setSecureItem(this.EMAIL_CONFIG_KEY, sensitiveConfig);
    } catch (error) {
      console.error('Failed to save email config:', error);
    }
  }

  /**
   * Load email configuration
   */
  static loadEmailConfig(): any {
    return SecureStorage.getSecureItem(this.EMAIL_CONFIG_KEY);
  }

  /**
   * Clear all setup-related secure data
   */
  static clearSetupData(): void {
    SecureStorage.removeSecureItem(this.SETUP_PROGRESS_KEY);
    SecureStorage.removeSecureItem(this.GOOGLE_ADS_CONFIG_KEY);
    SecureStorage.removeSecureItem(this.EMAIL_CONFIG_KEY);
  }
}