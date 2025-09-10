/**
 * SimilarWeb Configuration and Optimization Utilities
 * Provides tools for configuring and optimizing the SimilarWeb service
 */

import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedSimilarWebService, EnhancedSimilarWebConfig } from './enhanced-similarweb-service';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('SimilarWebConfig');

export interface SimilarWebOptimizationOptions {
  enableProxyRotation?: boolean;
  enableUserAgentRotation?: boolean;
  enableConfidenceScoring?: boolean;
  maxRetries?: number;
  timeout?: number;
  cacheTTL?: number;
  requestDelay?: number;
  preferredMethod?: 'api' | 'scraping' | 'auto';
}

export interface SimilarWebPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  cacheHitRate: number;
  apiSuccessRate: number;
  scrapingSuccessRate: number;
  averageConfidence: number;
}

export interface SimilarWebDiagnosticResult {
  healthy: boolean;
  issues: string[];
  recommendations: string[];
  metrics: SimilarWebPerformanceMetrics;
  configuration: EnhancedSimilarWebConfig;
}

/**
 * SimilarWeb Configuration Manager
 */
export class SimilarWebConfigManager {
  private service: EnhancedSimilarWebService;
  private config: EnhancedSimilarWebConfig;
  
  constructor(service: EnhancedSimilarWebService) {
    this.service = service;
    this.config = this.getCurrentConfig();
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): EnhancedSimilarWebConfig {
    return {
      apiEndpoints: [
        'https://data.similarweb.com/api/v1/data'  // Only confirmed working endpoint
      ],
      timeout: 45000,
      cacheTTL: 7 * 24 * 60 * 60 * 1000,
      errorCacheTTL: 1 * 60 * 60 * 1000,
      requestDelay: 3000,
      maxRetries: 5,
      preferredMethod: 'auto',
      enableConfidenceScoring: true,
      userAgentRotation: true,
      proxyRotation: false
    };
  }

  /**
   * Optimize configuration based on environment
   */
  optimizeForEnvironment(options?: SimilarWebOptimizationOptions): EnhancedSimilarWebConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const isVercel = process.env.VERCEL || process.env.NOW_REGION;
    const isDocker = process.env.DOCKER_ENV === 'true';
    
    const optimizedConfig: EnhancedSimilarWebConfig = {
      ...this.config,
      ...options
    };

    // Environment-specific optimizations
    if (isVercel) {
      // Vercel environment - prefer API, shorter timeouts
      optimizedConfig.preferredMethod = 'api';
      optimizedConfig.timeout = 20000;
      optimizedConfig.requestDelay = 1000;
      optimizedConfig.maxRetries = 3;
      optimizedConfig.proxyRotation = false;
    } else if (isDocker) {
      // Docker environment - balanced approach
      optimizedConfig.preferredMethod = 'auto';
      optimizedConfig.timeout = 35000;
      optimizedConfig.requestDelay = 2000;
      optimizedConfig.maxRetries = 4;
    } else if (isProduction) {
      // Production environment - prioritize reliability
      optimizedConfig.preferredMethod = 'auto';
      optimizedConfig.timeout = 45000;
      optimizedConfig.requestDelay = 3000;
      optimizedConfig.maxRetries = 5;
      optimizedConfig.cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
    } else {
      // Development environment - faster feedback
      optimizedConfig.preferredMethod = 'auto';
      optimizedConfig.timeout = 30000;
      optimizedConfig.requestDelay = 1000;
      optimizedConfig.maxRetries = 2;
      optimizedConfig.cacheTTL = 2 * 60 * 60 * 1000; // 2 hours
    }

    // Apply user overrides
    if (options) {
      Object.assign(optimizedConfig, options);
    }

    logger.info('Configuration optimized for environment', {
      environment: {
        isProduction,
        isVercel,
        isDocker
      },
      config: optimizedConfig
    });

    return optimizedConfig;
  }

  /**
   * Run diagnostics on the SimilarWeb service
   */
  async runDiagnostics(): Promise<SimilarWebDiagnosticResult> {
    logger.info('Running SimilarWeb service diagnostics');

    const issues: string[] = [];
    const recommendations: string[] = [];
    const health = this.service.getServiceHealth();
    const stats = this.service.getStatistics();

    // Calculate performance metrics
    const metrics: SimilarWebPerformanceMetrics = {
      totalRequests: stats.totalRequests,
      successfulRequests: stats.successfulRequests,
      failedRequests: stats.failedRequests,
      successRate: stats.successRate,
      averageResponseTime: stats.averageResponseTime,
      cacheHitRate: 0, // Would need to track this separately
      apiSuccessRate: health.apiAvailable ? 85 : 0, // Placeholder
      scrapingSuccessRate: health.scrapingAvailable ? 75 : 0, // Placeholder
      averageConfidence: 70 // Placeholder
    };

    // Check for issues
    if (metrics.successRate < 50) {
      issues.push('Low success rate (< 50%)');
      recommendations.push('Consider enabling third-party APIs or adjusting timeout settings');
    }

    if (metrics.averageResponseTime > 10000) {
      issues.push('High average response time (> 10s)');
      recommendations.push('Consider reducing timeout or enabling proxy rotation');
    }

    if (!health.apiAvailable && !health.scrapingAvailable) {
      issues.push('Both API and scraping services are unavailable');
      recommendations.push('Check network connectivity and service configuration');
    }

    if (!health.apiAvailable) {
      issues.push('API service is unavailable');
      recommendations.push('Check API endpoints and authentication');
    }

    if (!health.scrapingAvailable) {
      issues.push('Scraping service is unavailable');
      recommendations.push('Check browser service configuration');
    }

    if (health.cacheSize === 0) {
      recommendations.push('Consider enabling caching to improve performance');
    }

    // Environment-specific recommendations
    if (process.env.VERCEL) {
      if (!health.apiAvailable) {
        recommendations.push('Vercel environment requires working API endpoints');
      }
    }

    if (process.env.DOCKER_ENV) {
      if (!this.config.proxyRotation) {
        recommendations.push('Consider enabling proxy rotation in Docker environment');
      }
    }

    const healthy = issues.length === 0;

    logger.info('Diagnostics completed', {
      healthy,
      issuesCount: issues.length,
      recommendationsCount: recommendations.length,
      metrics
    });

    return {
      healthy,
      issues,
      recommendations,
      metrics,
      configuration: this.config
    };
  }

  /**
   * Apply optimization recommendations
   */
  async applyOptimizations(): Promise<EnhancedSimilarWebConfig> {
    const diagnostics = await this.runDiagnostics();
    const optimizations: SimilarWebOptimizationOptions = {};

    // Apply recommendations
    if (diagnostics.metrics.successRate < 50) {
      optimizations.maxRetries = Math.max((this.config.maxRetries || 3) + 2, 5);
      optimizations.timeout = Math.max((this.config.timeout || 30000) + 15000, 60000);
    }

    if (diagnostics.metrics.averageResponseTime > 10000) {
      optimizations.timeout = Math.min((this.config.timeout || 30000) - 5000, 15000);
      optimizations.enableProxyRotation = true;
    }

    if (!diagnostics.healthy) {
      optimizations.preferredMethod = 'auto';
      optimizations.enableUserAgentRotation = true;
      optimizations.enableConfidenceScoring = true;
    }

    // Apply optimizations
    this.config = this.optimizeForEnvironment(optimizations);

    logger.info('Optimizations applied', {
      optimizations,
      newConfig: this.config
    });

    return this.config;
  }

  /**
   * Get configuration summary
   */
  getConfigurationSummary(): {
    environment: string;
    preferredMethod: string;
    timeout: number;
    maxRetries: number;
    cacheTTL: string;
    features: {
      proxyRotation: boolean;
      userAgentRotation: boolean;
      confidenceScoring: boolean;
    };
  } {
    const isProduction = process.env.NODE_ENV === 'production';
    const isVercel = process.env.VERCEL || process.env.NOW_REGION;
    const isDocker = process.env.DOCKER_ENV === 'true';

    let environment = 'development';
    if (isProduction) environment = 'production';
    if (isVercel) environment = 'vercel';
    if (isDocker) environment = 'docker';

    return {
      environment,
      preferredMethod: this.config.preferredMethod || 'auto',
      timeout: this.config.timeout || 30000,
      maxRetries: this.config.maxRetries || 3,
      cacheTTL: this.formatDuration(this.config.cacheTTL || 0),
      features: {
        proxyRotation: this.config.proxyRotation || false,
        userAgentRotation: this.config.userAgentRotation || false,
        confidenceScoring: this.config.enableConfidenceScoring || false
      }
    };
  }

  /**
   * Export configuration for monitoring
   */
  exportConfiguration(): {
    config: EnhancedSimilarWebConfig;
    summary: ReturnType<typeof SimilarWebConfigManager.prototype.getConfigurationSummary>;
    timestamp: string;
    version: string;
  } {
    return {
      config: this.config,
      summary: this.getConfigurationSummary(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  }
}

/**
 * Factory function to create optimized SimilarWeb service
 */
export function createOptimizedSimilarWebService(options?: SimilarWebOptimizationOptions): {
  service: EnhancedSimilarWebService;
  configManager: SimilarWebConfigManager;
  config: EnhancedSimilarWebConfig;
} {
  // Create base service
  const service = new EnhancedSimilarWebService();
  const configManager = new SimilarWebConfigManager(service);
  
  // Optimize configuration
  const config = configManager.optimizeForEnvironment(options);
  
  logger.info('Created optimized SimilarWeb service', {
    config,
    options
  });

  return {
    service,
    configManager,
    config
  };
}

/**
 * Quick optimization utility
 */
export async function optimizeSimilarWebService(): Promise<{
  success: boolean;
  config: EnhancedSimilarWebConfig;
  diagnostics: SimilarWebDiagnosticResult;
  recommendations: string[];
}> {
  try {
    const { service, configManager } = createOptimizedSimilarWebService();
    
    // Run diagnostics
    const diagnostics = await configManager.runDiagnostics();
    
    // Apply optimizations if needed
    let finalConfig = configManager.getCurrentConfig();
    if (!diagnostics.healthy) {
      finalConfig = await configManager.applyOptimizations();
    }
    
    return {
      success: diagnostics.healthy,
      config: finalConfig,
      diagnostics,
      recommendations: diagnostics.recommendations
    };
  } catch (error) {
    logger.error('Failed to optimize SimilarWeb service', new EnhancedError('Failed to optimize SimilarWeb service', { error: error instanceof Error ? error.message : String(error)
     }));
    
    return {
      success: false,
      config: new SimilarWebConfigManager(new EnhancedSimilarWebService()).getCurrentConfig(),
      diagnostics: {
        healthy: false,
        issues: ['Optimization failed'],
        recommendations: ['Check service configuration and logs'],
        metrics: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          successRate: 0,
          averageResponseTime: 0,
          cacheHitRate: 0,
          apiSuccessRate: 0,
          scrapingSuccessRate: 0,
          averageConfidence: 0
        },
        configuration: new SimilarWebConfigManager(new EnhancedSimilarWebService()).getCurrentConfig()
      },
      recommendations: []
    };
  }
}

// Export convenience functions
export { createOptimizedSimilarWebService as createSimilarWebService };
export { SimilarWebConfigManager as ConfigManager };