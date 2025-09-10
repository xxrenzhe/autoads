/**
 * Startup Validation
 * 应用启动时的安全验证
 */

import { validateEnvOnStartup } from "@/lib/utils/security/env-validation";
import { validateEncryptionSetup } from "@/lib/utils/security/encryption";
import { validateConfig, logConfigSafely } from "@/lib/utils/security/secure-config";
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('startup-validation');


/**
 * 执行启动时的所有验证
 */
export function performStartupValidation(): void {
  logger.info('🔍 Starting application security validation...');
  
  try {
    // 1. 验证环境变量
    logger.info('📋 Validating environment variables...');
    validateEnvOnStartup();
    
    // 2. 验证加密设置
    logger.info('🔐 Validating encryption setup...');
    if (!validateEncryptionSetup()) {
      throw new Error('Encryption setup validation failed');
    }
    logger.info('✅ Encryption setup is valid');
    
    // 3. 验证配置完整性
    logger.info('⚙️ Validating configuration...');
    const configValidation = validateConfig();
    if (!configValidation.isValid) {
      logger.error('❌ Configuration validation failed:');
      configValidation.errors.forEach(error => logger.error(`  - ${error}`));
      throw new Error('Configuration validation failed');
    }
    logger.info('✅ Configuration is valid');
    
    // 4. 安全地记录配置信息
    if (process.env.NODE_ENV !== 'production') {
      logger.info('📝 Configuration summary:');
      logConfigSafely();
    }
    
    logger.info('✅ All security validations passed successfully');
    
  } catch (error) {
    logger.error('❌ Startup validation failed:', new EnhancedError('Startup validation failed', { 
      error: error instanceof Error ? error.message : String(error) 
    }));
    
    if (process.env.NODE_ENV === 'production') {
      logger.error('🚨 Application cannot start in production with invalid configuration');
      process.exit(1);
    } else {
      logger.warn('⚠️ Continuing in development mode despite validation errors');
    }
  }
}

/**
 * 验证生产环境的额外安全要求
 */
export function validateProductionSecurity(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  
  logger.info('🔒 Validating production security requirements...');
  
  const requiredSecurityEnvVars = [
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    'SESSION_SECRET'
  ];
  
  const missingVars = requiredSecurityEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    logger.error('❌ Missing required security environment variables in production:');
    missingVars.forEach(varName => logger.error(`  - ${varName}`));
    process.exit(1);
  }
  
  // 验证密钥长度
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length < 32) {
    logger.error('❌ ENCRYPTION_KEY must be at least 32 characters in production'); // SECURITY: Sensitive data filtered
    process.exit(1);
  }
  
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.error('❌ JWT_SECRET must be at least 32 characters in production'); // SECURITY: Sensitive data filtered
    process.exit(1);
  }
  
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    logger.error('❌ SESSION_SECRET must be at least 32 characters in production'); // SECURITY: Sensitive data filtered
    process.exit(1);
  }
  
  logger.info('✅ Production security requirements validated');
}

/**
 * 检查是否有潜在的安全风险
 */
export function checkSecurityRisks(): void {
  logger.info('🛡️ Checking for potential security risks...');
  
  const warnings: string[] = [];
  
  // 检查是否在生产环境中使用了开发配置
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DEV_MODE === 'true') {
      warnings.push('DEV_MODE is enabled in production');
    }
    
    if (process.env.NEXT_PUBLIC_BASE_URL?.includes('localhost')) {
      warnings.push('Base URL contains localhost in production');
    }
    
    if (!process.env.DB_PASSWORD) {
      warnings.push('Database password is not set in production');
    }
  }
  
  // 检查弱密钥
  if (process.env.ENCRYPTION_KEY === 'default-key' || process.env.ENCRYPTION_KEY === 'test-key') {
    warnings.push('Using default or test encryption key');
  }
  
  if (process.env.JWT_SECRET === 'default-secret' || process.env.JWT_SECRET === 'test-secret') {
    warnings.push('Using default or test JWT secret');
  }
  
  if (warnings.length > 0) {
    logger.warn('⚠️ Security warnings detected:');
    warnings.forEach(warning => logger.warn(`  - ${warning}`));
  } else {
    logger.info('✅ No security risks detected');
  }
}