/**
 * Dynamic Import Utilities - Load heavy dependencies only when needed
 * Reduces initial bundle size and improves startup performance
 */

/**
 * Dynamic import wrapper for Google Ads API
 */
export async function loadGoogleAdsApi() {
  try {
    const { GoogleAdsApi, Customer, resources, services, enums } = await import('google-ads-api');
    return { GoogleAdsApi, Customer, resources, services, enums };
  } catch (error) {
    console.error('Failed to load Google Ads API:', error);
    throw new Error('Google Ads API not available');
  }
}

/**
 * Dynamic import wrapper for HTTP client (替代浏览器自动化)
 */
export async function loadHttpClient() {
  try {
    // 使用内置的fetch API，无需额外导入
    return {
      fetch: globalThis.fetch,
      Request: globalThis.Request,
      Response: globalThis.Response,
      Headers: globalThis.Headers,
    };
  } catch (error) {
    console.error('Failed to load HTTP client:', error);
    throw new Error('HTTP client not available');
  }
}

/**
 * Dynamic import wrapper for Chromium
 */
export async function loadChromium() {
  // 不再需要Chromium，返回空实现
  console.warn('Chromium loading is deprecated, using HTTP client instead');
  return {
    executablePath: () => '/usr/bin/chromium-browser',
    args: [],
    headless: true
  };
}

/**
 * Dynamic import wrapper for browser services
 */
export async function loadBrowserService() {
  try {
    const { UnifiedBrowserService } = await import('@/lib/browser/unified-browser-service');
    return UnifiedBrowserService;
  } catch (error) {
    console.error('Failed to load browser service:', error);
    throw new Error('Browser service not available');
  }
}

/**
 * Dynamic import wrapper for Google Ads service
 */
export async function loadGoogleAdsService() {
  try {
    const { UnifiedGoogleAdsService } = await import('@/lib/google-ads/unified-google-ads-service');
    return UnifiedGoogleAdsService;
  } catch (error) {
    console.error('Failed to load Google Ads service:', error);
    throw new Error('Google Ads service not available');
  }
}

/**
 * Dynamic import wrapper for SimilarWeb service
 */
export async function loadSimilarWebService() {
  try {
    const { UnifiedSimilarWebService } = await import('@/lib/siterank/unified-similarweb-service');
    return UnifiedSimilarWebService;
  } catch (error) {
    console.error('Failed to load SimilarWeb service:', error);
    throw new Error('SimilarWeb service not available');
  }
}

/**
 * Lazy loading service class
 */
export class LazyService<T> {
  private service: T | null = null;
  private loader: () => Promise<T>;
  private loadingPromise: Promise<T> | null = null;

  constructor(loader: () => Promise<T>) {
    this.loader = loader;
  }

  async getService(): Promise<T> {
    if (this.service) {
      return this.service;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.loader()
      .then(service => {
        this.service = service;
        this.loadingPromise = null;
        return service;
      })
      .catch(error => {
        this.loadingPromise = null;
        throw error;
      });

    return this.loadingPromise;
  }

  isLoaded(): boolean {
    return this.service !== null;
  }

  reset(): void {
    this.service = null;
    this.loadingPromise = null;
  }
}

/**
 * Service registry for managing dynamic services
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, LazyService<any>> = new Map();

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register<T>(name: string, loader: () => Promise<T>): void {
    this.services.set(name, new LazyService(loader));
  }

  async get<T>(name: string): Promise<T> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }
    return service.getService();
  }

  isLoaded(name: string): boolean {
    const service = this.services.get(name);
    return service ? service.isLoaded() : false;
  }

  reset(name?: string): void {
    if (name) {
      const service = this.services.get(name);
      if (service) {
        service.reset();
      }
    } else {
      this.services.forEach((service: any) => service.reset());
    }
  }
}

/**
 * Initialize service registry with default services
 */
export function initializeServiceRegistry() {
  const registry = ServiceRegistry.getInstance();

  // Register heavy services
  registry.register('googleAdsApi', loadGoogleAdsApi);
  registry.register('httpClient', loadHttpClient);
  registry.register('chromium', loadChromium);
  registry.register('browserService', loadBrowserService);
  registry.register('googleAdsService', loadGoogleAdsService);
  registry.register('similarWebService', loadSimilarWebService);

  return registry;
}

/**
 * React hook for dynamic imports
 */
export function useDynamicImport<T>(
  loader: () => Promise<T>,
  options: {
    enabled?: boolean;
    retryCount?: number;
    retryDelay?: number;
  } = {}
) {
  const { enabled = true, retryCount = 3, retryDelay = 1000 } = options;

  const load = async (): Promise<T | null> => {
    if (!enabled) return null as any;

    let lastError: Error | null = null;
    
    for (let i = 0; i < retryCount; i++) {
      try {
        try {

        return await loader();

        } catch (error) {

          console.error(error);

          return null as any;

        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw lastError || new Error('Failed to load module');
  };

  return { load };
}

/**
 * Performance monitoring for dynamic imports
 */
export class ImportPerformanceMonitor {
  private static instance: ImportPerformanceMonitor;
  private metrics: Map<string, Array<{ loadTime: number; timestamp: number }>> = new Map();

  private constructor() {}

  static getInstance(): ImportPerformanceMonitor {
    if (!ImportPerformanceMonitor.instance) {
      ImportPerformanceMonitor.instance = new ImportPerformanceMonitor();
    }
    return ImportPerformanceMonitor.instance;
  }

  async measureImport<T>(
    name: string,
    loader: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await loader();
      const loadTime = performance.now() - startTime;
      
      this.recordMetric(name, loadTime);
      return result;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      this.recordMetric(name, loadTime, false);
      throw error;
    }
  }

  private recordMetric(name: string, loadTime: number, success: boolean = true): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    this.metrics.get(name)!.push({
      loadTime,
      timestamp: Date.now()
    });

    // Log slow imports
    if (loadTime > 5000) {
      console.warn(`Slow import detected: ${name} took ${loadTime.toFixed(2)}ms`);
    }
  }

  getMetrics(name?: string) {
    if (name) {
      return this.metrics.get(name) || [];
    }
    return Object.fromEntries(this.metrics);
  }

  getAverageLoadTime(name: string): number {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric: any) => sum + metric.loadTime, 0);
    return total / metrics.length;
  }

  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

// Export utility functions
export const serviceRegistry = initializeServiceRegistry();
export const performanceMonitor = ImportPerformanceMonitor.getInstance();

// Default export
const dynamicImportsExports = {
  loadGoogleAdsApi,
  loadHttpClient,
  loadChromium,
  loadBrowserService,
  loadGoogleAdsService,
  loadSimilarWebService,
  LazyService,
  ServiceRegistry,
  useDynamicImport,
  ImportPerformanceMonitor,
  serviceRegistry,
  performanceMonitor
};

export default dynamicImportsExports;