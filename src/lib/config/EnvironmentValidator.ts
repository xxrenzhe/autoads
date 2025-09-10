/**
 * Environment Variable Validator
 * 环境变量验证器，确保所有必需的环境变量都已设置
 */

export interface EnvironmentConfig {
  // Database
  DATABASE_URL: string;
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  
  // Redis
  REDIS_URL?: string;
  
  // Authentication
  NEXTAUTH_SECRET?: string;
  NEXTAUTH_URL?: string;
  
  // Google APIs
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_ADS_DEVELOPER_TOKEN?: string;
  
  // Application
  APP_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  
  // Optional with defaults
  PORT?: string;
  LOG_LEVEL?: string;
}

export class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private config: EnvironmentConfig;
  
  private constructor() {
    this.config = this.validateAndLoad();
  }
  
  static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }
  
  getConfig(): EnvironmentConfig {
    return this.config;
  }
  
  private validateAndLoad(): EnvironmentConfig {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required variables
    const requiredVars = [
      'DATABASE_URL',
      'APP_URL'
    ];
    
    // Check required variables
    requiredVars.forEach(varName => {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    });
    
    // Conditional requirements
    if (process.env.NODE_ENV === 'production') {
      const productionRequired = [
        'NEXTAUTH_SECRET',
        'GOOGLE_CLIENT_SECRET'
      ];
      
      productionRequired.forEach(varName => {
        if (!process.env[varName]) {
          errors.push(`Missing required production environment variable: ${varName}`);
        }
      });
    }
    
    // Validate formats
    if (process.env.DATABASE_URL && !this.isValidUrl(process.env.DATABASE_URL)) {
      errors.push('DATABASE_URL must be a valid URL');
    }
    
    if (process.env.REDIS_URL && !this.isValidUrl(process.env.REDIS_URL)) {
      errors.push('REDIS_URL must be a valid URL');
    }
    
    if (process.env.APP_URL && !this.isValidUrl(process.env.APP_URL)) {
      errors.push('APP_URL must be a valid URL');
    }
    
    // Port validation
    if (process.env.PORT && !this.isValidPort(process.env.PORT)) {
      errors.push('PORT must be a valid port number');
    }
    
    // Warnings for missing optional but recommended variables
    const recommendedVars = [
      'REDIS_URL',
      'GOOGLE_CLIENT_ID',
      'NEXTAUTH_SECRET'
    ];
    
    recommendedVars.forEach(varName => {
      if (!process.env[varName]) {
        warnings.push(`Recommended environment variable not set: ${varName}`);
      }
    });
    
    // Log results
    if (errors.length > 0) {
      console.error('Environment validation errors:');
      errors.forEach(error => console.error(`  - ${error}`));
      throw new Error(`Environment validation failed with ${errors.length} errors`);
    }
    
    if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
      console.warn('Environment validation warnings:');
      warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    // Return validated config
    return {
      DATABASE_URL: process.env.DATABASE_URL!,
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      
      REDIS_URL: process.env.REDIS_URL,
      
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      
      APP_URL: process.env.APP_URL!,
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      
      PORT: process.env.PORT || '3000',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info'
    };
  }
  
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  private isValidPort(port: string): boolean {
    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
  }
  
  // Utility methods
  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }
  
  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }
  
  isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }
}

// Export singleton instance
export const environmentConfig = EnvironmentValidator.getInstance().getConfig();
export const environmentValidator = EnvironmentValidator.getInstance();

// Validate on import (except in test environment)
if (process.env.NODE_ENV !== 'test') {
  environmentValidator.getConfig();
}