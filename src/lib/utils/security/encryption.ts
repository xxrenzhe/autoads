/**
 * Encryption Utilities
 * 用于加密和解密敏感数据
 */

import * as crypto from 'crypto';
// import { EnhancedError } from '@/lib/utils/error-handling';

/**
 * 加密配置
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 32
};

/**
 * 加密结果接口
 */
export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
}

/**
 * 从密码生成密钥
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, ENCRYPTION_CONFIG.keyLength, 'sha256');
}

/**
 * 获取加密密钥
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
  }
  
  return key;
}

/**
 * 加密数据
 */
export function encrypt(data: string): EncryptionResult {
  try {
    const password = getEncryptionKey();
    const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const key = deriveKey(password, salt);
    
    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
    (cipher as any).setAAD(salt); // 使用salt作为附加认证数据
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = (cipher as any).getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      salt: salt.toString('hex')
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown error" as any}`);
  }
}

/**
 * 解密数据
 */
export function decrypt(encryptionResult: EncryptionResult): string {
  try {
    const password = getEncryptionKey();
    const salt = Buffer.from(encryptionResult.salt, 'hex');
    const iv = Buffer.from(encryptionResult.iv, 'hex');
    const tag = Buffer.from(encryptionResult.tag, 'hex');
    const key = deriveKey(password, salt);
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
    (decipher as any).setAAD(salt);
    (decipher as any).setAuthTag(tag);
    
    let decrypted = decipher.update(encryptionResult.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error" as any}`);
  }
}

/**
 * 生成安全的随机密钥
 */
export function generateSecureKey(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 哈希密码（用于存储）
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * 验证密码
 */
export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    return hash === verifyHash;
  } catch {
    return false;
  }
}

/**
 * 创建数据签名
 */
export function createSignature(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * 验证数据签名
 */
export function verifySignature(data: string, signature: string, secret: string): boolean {
  const expectedSignature = createSignature(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * 安全地比较两个字符串（防止时序攻击）
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * 生成JWT密钥
 */
export function generateJWTSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * 加密敏感的环境变量值
 */
export function encryptEnvValue(value: string): string {
  const result = encrypt(value);
  return JSON.stringify(result);
}

/**
 * 解密敏感的环境变量值
 */
export function decryptEnvValue(encryptedValue: string): string {
  const result = JSON.parse(encryptedValue) as EncryptionResult;
  return decrypt(result);
}

/**
 * 安全地清除内存中的敏感数据
 */
export function secureClear(obj: unknown): void {
  if (typeof obj === 'string') {
    // 对于字符串，我们无法直接清除内存，但可以重新赋值
    obj = '\0'.repeat(obj.length);
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        secureClear((obj as any)[key]);
        delete (obj as any)[key];
      }
    }
  }
}

/**
 * 检查加密配置是否正确
 */
export function validateEncryptionSetup(): boolean {
  try {
    const testData = 'test-encryption-data';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return decrypted === testData;
  } catch {
    return false;
  }
}