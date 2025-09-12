/**
 * Unified Configuration Service - Centralized configuration management
 * Consolidates all configuration sources with validation and environment awareness
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('UnifiedConfigService');

// Configuration interfaces
export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  url: string;
  email: string;
  github?: string;
  twitter?: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  rateLimit: {
    requests: number;
    window: number;
  };
}

export interface ExternalApiConfig {
  similarWeb: {
    apiUrl: string;
    timeout: number;
  };
  googleAds: {
    apiUrl: string;
    version: string;
    timeout: number;
  };
  adsPower: {
    apiUrl: string;
    timeout: number;
  };
}

export interface FeatureConfig {
  urlAnalysis: boolean;
  siteRanking: boolean;
  dataExport: boolean;
  chromeExtension: boolean;
  manualInput: boolean;
  realTimeUpdates: boolean;
  advancedAnalytics: boolean;
}

export interface PerformanceConfig {
  maxConcurrentRequests: number;
  requestDelay: number;
  cacheTimeout: number;
  maxCacheSize: number;
}

export interface SecurityConfig {
  allowedDomains: string[];
  blockedDomains: string[];
  maxUrlLength: number;
  validateUrls: boolean;
  sanitizeInput: boolean;
}

export interface SeoConfig {
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string;
  defaultImage: string;
  twitterHandle: string;
  siteName: string;
}

export interface EnvironmentConfig {
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  isVercel: boolean;
  isDocker: boolean;
  platform: string;
  version: string;
}

export interface FullAppConfig {
  site: SiteConfig;
  api: ApiConfig;
  external: ExternalApiConfig;
  features: FeatureConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
  seo: SeoConfig;
  environment: EnvironmentConfig;
}

// Configuration validation interface
export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Unified Configuration Service with validation and environment awareness
 */
export class UnifiedConfigService {
  private config: FullAppConfig;
  private validationRules: Map<string, ValidationRule<any>[]> = new Map();
  private watchers: Map<string, Set<(newValue: any, oldValue: any) => void>> = new Map();

  constructor() {
    this.config = this.loadConfiguration();
    this.setupValidationRules();
    this.setupEnvironmentListeners();
    
    logger.info('UnifiedConfigService initialized', {
      environment: this.config.environment,
      configKeys: Object.keys(this.config)
    });
  }

  /**
   * Load configuration from environment and defaults
   */
  private loadConfiguration(): FullAppConfig {
    const environment = this.detectEnvironment();
    
    return {
      site: {
        name: process.env.NEXT_PUBLIC_APP_NAME || "AutoAds",
        title: process.env.NEXT_PUBLIC_APP_TITLE || "AutoAds - 一站式自动化营销平台 | 真实点击、网站排名分析、智能广告投放",
        description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "AutoAds是一站式自动化营销平台，提供真实点击、网站排名分析、智能广告投放三大核心功能。",
        url: process.env.NEXT_PUBLIC_BASE_URL || "https://autoads.dev",
        email: process.env.NEXT_PUBLIC_APP_EMAIL || "contact@autoads.dev",
        github: process.env.NEXT_PUBLIC_GITHUB_URL,
        twitter: process.env.NEXT_PUBLIC_TWITTER_URL
      },

      api: {
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.autoads.dev",
        timeout: parseInt(process.env.API_TIMEOUT || "30000"),
        retries: parseInt(process.env.API_RETRIES || "3"),
        rateLimit: {
          requests: parseInt(process.env.API_RATE_LIMIT_REQUESTS || "100"),
          window: parseInt(process.env.API_RATE_LIMIT_WINDOW || "60000"),
        },
      },

      external: {
        similarWeb: {
          apiUrl: process.env.NEXT_PUBLIC_SIMILARWEB_API_URL || "https://data.similarweb.com/api/v1/data",
          timeout: parseInt(process.env.NEXT_PUBLIC_SIMILARWEB_TIMEOUT || "30000"),
        },
        googleAds: {
          apiUrl: "https://googleads.googleapis.com",
          version: process.env.NEXT_PUBLIC_GOOGLE_ADS_API_VERSION || "v14",
          timeout: parseInt(process.env.GOOGLE_ADS_TIMEOUT || "30000"),
        },
        adsPower: {
          apiUrl: process.env.NEXT_PUBLIC_ADSPOWER_API_URL || "http://local.adspower.net:50325",
          timeout: parseInt(process.env.ADSPOWER_TIMEOUT || "10000"),
        },
      },

      features: {
        urlAnalysis: process.env.FEATURE_URL_ANALYSIS !== "false",
        siteRanking: process.env.FEATURE_SITE_RANKING !== "false",
        dataExport: process.env.FEATURE_DATA_EXPORT !== "false",
        chromeExtension: process.env.FEATURE_CHROME_EXTENSION !== "false",
        manualInput: process.env.FEATURE_MANUAL_INPUT !== "false",
        realTimeUpdates: process.env.FEATURE_REAL_TIME_UPDATES !== "false",
        advancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS === "true",
      },

      performance: {
        maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || "10"),
        requestDelay: parseInt(process.env.REQUEST_DELAY || "100"),
        cacheTimeout: parseInt(process.env.CACHE_TIMEOUT || "300000"),
        maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || "1000"),
      },

      security: {
        allowedDomains: process.env.ALLOWED_DOMAINS?.split(',') || ["*"],
        blockedDomains: process.env.BLOCKED_DOMAINS?.split(',') || [],
        maxUrlLength: parseInt(process.env.MAX_URL_LENGTH || "2048"),
        validateUrls: process.env.VALIDATE_URLS !== "false",
        sanitizeInput: process.env.SANITIZE_INPUT !== "false",
      },

      seo: {
        defaultTitle: process.env.NEXT_PUBLIC_DEFAULT_TITLE || "AutoAds - 一站式自动化营销平台 | 专业数字营销解决方案",
        defaultDescription: process.env.NEXT_PUBLIC_DEFAULT_DESCRIPTION || "AutoAds一站式自动化营销平台，集成真实点击、网站排名分析、智能广告投放三大核心功能。",
        defaultKeywords: process.env.NEXT_PUBLIC_DEFAULT_KEYWORDS || "自动化营销平台, 数字营销, 真实点击, 网站排名分析, 智能广告投放",
        defaultImage: process.env.NEXT_PUBLIC_DEFAULT_IMAGE || "/og-image.png",
        twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@autoads_dev",
        siteName: process.env.NEXT_PUBLIC_SITE_NAME || "AutoAds",
      },

      environment
    };
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';
    const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
    const isDocker = process.env.DOCKER_ENV === 'true';

    return {
      nodeEnv,
      isDevelopment,
      isProduction,
      isTest,
      isVercel,
      isDocker,
      platform: process.platform,
      version: process.version
    };
  }

  /**
   * Setup validation rules
   */
  private setupValidationRules(): void {
    // URL validation
    this.validationRules.set('site.url', [{
      validate: (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Invalid URL format'
    }]);

    // Email validation
    this.validationRules.set('site.email', [{
      validate: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      message: 'Invalid email format'
    }]);

    // Timeout validation
    this.validationRules.set('api.timeout', [{
      validate: (timeout: number) => timeout > 0 && timeout <= 300000,
      message: 'Timeout must be between 1 and 300000ms'
    }]);

    // Rate limit validation
    this.validationRules.set('api.rateLimit.requests', [{
      validate: (requests: number) => requests > 0 && requests <= 10000,
      message: 'Rate limit requests must be between 1 and 10000'
    }]);

    // Feature flags validation
    Object.keys(this.config.features).forEach(key => {
      this.validationRules.set(`features.${key}`, [{
        validate: (value: boolean) => typeof value === 'boolean',
        message: `Feature flag ${key} must be boolean`
      }]);
    });
  }

  /**
   * Setup environment listeners for hot reload
   */
  private setupEnvironmentListeners(): void {
    if (typeof window !== 'undefined') {
      // In browser, listen for storage events (for cross-tab updates)
      window.addEventListener('storage', (event) => {
        if (event.key === 'config-update') {
          logger.info('Configuration update detected, reloading');
          this.reloadConfiguration();
        }
      });
    }
  }

  /**
   * Get configuration value by path
   */
  get<T = any>(path: string): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        throw new Error(`Configuration path not found: ${path}`);
      }
    }

    return value as T;
  }

  /**
   * Set configuration value by path
   */
  set<T = any>(path: string, value: T): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target: any = this.config;

    // Navigate to parent object
    for (const key of keys) {
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    // Notify watchers
    this.notifyWatchers(path, value, oldValue);

    logger.debug('Configuration updated', { path, value, oldValue });
  }

  /**
   * Get entire configuration
   */
  getConfig(): FullAppConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate all rules
    for (const [path, rules] of this.validationRules.entries()) {
      try {
        const value = this.get(path);
        
        for (const rule of rules) {
          if (!rule.validate(value)) {
            errors.push(`${path}: ${rule.message}`);
          }
        }
      } catch (error) {
        errors.push(`${path}: Configuration path not found`);
      }
    }

    // Check for deprecated environment variables
    const deprecatedVars = [
      'NEXT_PUBLIC_LEGACY_API_URL',
      'OLD_TIMEOUT_CONFIG',
      'DEPRECATED_FEATURE_FLAG'
    ];

    deprecatedVars.forEach(envVar => {
      if (process.env[envVar]) {
        warnings.push(`Deprecated environment variable: ${envVar}`);
      }
    });

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn('Configuration validation failed', { errors, warnings });
    }

    return { isValid, errors, warnings };
  }

  /**
   * Watch for configuration changes
   */
  watch(path: string, callback: (newValue: any, oldValue: any) => void): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set());
    }

    this.watchers.get(path)!.add(callback);

    // Return unsubscribe function
    return () => {
      const watchers = this.watchers.get(path);
      if (watchers) {
        watchers.delete(callback);
        if (watchers.size === 0) {
          this.watchers.delete(path);
        }
      }
    };
  }

  /**
   * Notify watchers of configuration changes
   */
  private notifyWatchers(path: string, newValue: any, oldValue: any): void {
    const watchers = this.watchers.get(path);
    if (watchers) {
      watchers.forEach(callback => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          logger.error('Configuration watcher error', new EnhancedError('Configuration watcher error', {  
            path, 
            error: error instanceof Error ? error.message : String(error) 
           }));
        }
      });
    }
  }

  /**
   * Reload configuration from environment
   */
  reloadConfiguration(): void {
    const oldConfig = { ...this.config };
    this.config = this.loadConfiguration();
    
    // Detect changes and notify watchers
    this.detectChanges(oldConfig, this.config);
    
    logger.info('Configuration reloaded');
  }

  /**
   * Detect configuration changes and notify watchers
   */
  private detectChanges(oldConfig: any, newConfig: any, path: string = ''): void {
    for (const key in newConfig) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof newConfig[key] === 'object' && newConfig[key] !== null) {
        this.detectChanges(oldConfig[key], newConfig[key], currentPath);
      } else if (oldConfig[key] !== newConfig[key]) {
        this.notifyWatchers(currentPath, newConfig[key], oldConfig[key]);
      }
    }
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(): EnvironmentConfig {
    return { ...this.config.environment };
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof FeatureConfig): boolean {
    return this.config.features[feature];
  }

  /**
   * Get feature flags
   */
  getFeatures(): FeatureConfig {
    return { ...this.config.features };
  }

  /**
   * Enable/disable a feature
   */
  setFeature(feature: keyof FeatureConfig, enabled: boolean): void {
    this.set(`features.${feature}`, enabled);
  }

  /**
   * Get API configuration for external services
   */
  getExternalApiConfig(service: keyof ExternalApiConfig): ExternalApiConfig[keyof ExternalApiConfig] {
    return { ...this.config.external[service] };
  }

  /**
   * Export configuration to JSON
   */
  exportToJson(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importFromJson(jsonString: string): ValidationResult {
    try {
      const newConfig = JSON.parse(jsonString);
      this.config = { ...this.config, ...newConfig };
      
      const validation = this.validate();
      if (validation.isValid) {
        logger.info('Configuration imported successfully');
      }
      
      return validation;
    } catch (error) {
      logger.error('Failed to import configuration', new EnhancedError('Failed to import configuration', { error: error instanceof Error ? error.message : String(error) 
       }));
      
      return {
        isValid: false,
        errors: ['Invalid JSON format'],
        warnings: []
      };
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults(): void {
    this.config = this.loadConfiguration();
    logger.info('Configuration reset to defaults');
  }
}

// Factory function to create configuration service
export function createConfigService(): UnifiedConfigService {
  return new UnifiedConfigService();
}

// Default singleton instance
export const configService = createConfigService();

// Convenience getters for common configuration
export const config = {
  get: <T = any>(path: string) => configService.get<T>(path),
  set: <T = any>(path: string, value: T) => configService.set<T>(path, value),
  getFeatures: () => configService.getFeatures(),
  isFeatureEnabled: (feature: keyof FeatureConfig) => configService.isFeatureEnabled(feature),
  getEnvironment: () => configService.getEnvironmentConfig(),
  validate: () => configService.validate(),
  watch: (path: string, callback: (newValue: any, oldValue: any) => void) => 
    configService.watch(path, callback)
};

// Legacy compatibility
export const APP_CONFIG = configService.getConfig();
export type AppConfig = FullAppConfig;
export const getFullUrl = (path: string) => `${config.get<string>('site.url')}${path}`;

// Export default
export default UnifiedConfigService;