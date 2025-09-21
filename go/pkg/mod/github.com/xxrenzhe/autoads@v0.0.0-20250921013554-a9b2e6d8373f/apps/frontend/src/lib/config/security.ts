/**
 * Security configuration types and utilities
 */

/**
 * Keys that should be filtered from logs
 */
const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'key',
  'authorization',
  'auth',
  'credit',
  'card',
  'ssn',
  'social',
  'personal',
  'private',
  'confidential'
];

/**
 * Check if a key should be filtered from logs
 */
export function shouldFilterFromLogs(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitive => 
    lowerKey.includes(sensitive) || 
    lowerKey.endsWith(sensitive) ||
    lowerKey.startsWith(sensitive)
  );
}

export interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyLength: number;
    iterations: number;
  };
  validation: {
    maxInputLength: number;
    allowedDomains: string[];
    blockedPatterns: string[];
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    sanitizeSensitiveData: boolean;
    maxLogLength: number;
  };
}

export const defaultSecurityConfig: SecurityConfig = {
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    iterations: 100000
  },
  validation: {
    maxInputLength: 10000,
    allowedDomains: [],
    blockedPatterns: [
      '<script',
      'javascript:',
      'onload=',
      'onclick=',
      'onerror='
    ]
  },
  logging: {
    level: 'info',
    sanitizeSensitiveData: true,
    maxLogLength: 1000
  }
};