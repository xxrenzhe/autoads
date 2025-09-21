/**
 * Critical Environment Variable Validation
 * Validates required environment variables before application startup
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCriticalEnvironmentVariables(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };

  // Required variables for application startup
  const requiredVars = [
    'NODE_ENV',
    'NEXT_PUBLIC_DEPLOYMENT_ENV',
    'DATABASE_URL',
    'AUTH_GOOGLE_ID',
    'AUTH_GOOGLE_SECRET'
  ];

  // Check required variables
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      result.errors.push(`Missing required environment variable: ${varName}`);
      result.valid = false;
    }
  }

  // Validate secret presence: accept either AUTH_SECRET or NEXTAUTH_SECRET
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    result.errors.push('Missing authentication secret: set AUTH_SECRET or NEXTAUTH_SECRET');
    result.valid = false;
  } else if (secret.length < 32) {
    result.errors.push('Authentication secret must be at least 32 characters (recommend 64 bytes)');
    result.valid = false;
  }

  // Validate database URL format (MySQL)
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      if (!dbUrl.hostname || !dbUrl.protocol.includes('mysql')) {
        result.errors.push('DATABASE_URL must be a valid MySQL connection string');
        result.valid = false;
      }
    } catch (error) {
      result.errors.push('DATABASE_URL is not a valid URL');
      result.valid = false;
    }
  }

  // Check memory configuration
  const memoryLimit = process.env.MEMORY_LIMIT || process.env.CONTAINER_MEMORY_LIMIT;
  if (memoryLimit) {
    // Extract numeric value from memory limit (e.g., "4Gi" -> 4096)
    const memoryValue = parseInt(memoryLimit);
    if (memoryValue < 2048) { // Less than 2GB
      result.warnings.push(`Memory limit ${memoryLimit} might be too low for production usage`);
    }
  }

  // Warn if Node.js memory limit is not set
  const nodeOptions = process.env.NODE_OPTIONS || '';
  if (!nodeOptions.includes('--max-old-space-size')) {
    result.warnings.push('NODE_OPTIONS should include --max-old-space-size to prevent memory issues');
  }

  // Production: require a canonical base URL for NextAuth to avoid redirect_uri mismatch
  if ((process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'production' || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'preview') && !process.env.NEXTAUTH_URL && !process.env.AUTH_URL) {
    result.errors.push('Missing NEXTAUTH_URL or AUTH_URL in production/preview environment');
    result.valid = false;
  }

  return result;
}

export function logValidationResult(result: ValidationResult): void {
  if (result.errors.length > 0) {
    console.error('❌ Critical Environment Validation Failed:');
    result.errors.forEach((error: any) => console.error(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Warnings:');
    result.warnings.forEach((warning: any) => console.warn(`  - ${warning}`));
  }

  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    console.log('✅ All environment variables validated successfully');
  }
}

// Auto-validate on module import
if (process.env.NODE_ENV === 'production') {
  const validation = validateCriticalEnvironmentVariables();
  logValidationResult(validation);
  
  if (!validation.valid) {
    console.error('🚨 Application cannot start due to missing required configuration');
    // Don't exit immediately, let the application handle it gracefully
  }
}
