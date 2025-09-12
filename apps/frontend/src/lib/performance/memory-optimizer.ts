export interface MemoryUsage {
  rss: number; // Resident Set Size
  heapTotal: number;
  heapUsed: number;
  external: number;
  percentage: number;
}

export class MemoryOptimizer {
  private threshold: number = 0.8; // 80% threshold
  private gcInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      percentage: usage.heapUsed / totalMemory,
    };
  }

  /**
   * Check if memory usage is high
   */
  isMemoryHigh(): boolean {
    const usage = this.getMemoryUsage();
    return usage.percentage > this.threshold;
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Clear unused caches
   */
  async clearCaches(): Promise<void> {
    try {
      // Clear various caches
      const { apiCache, dbCache, configCache } = await import('@/lib/cache/RedisCacheService');
      await Promise.all([
        apiCache.clear(),
        dbCache.clear(),
        configCache.clear(),
      ]);
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    this.gcInterval = setInterval(() => {
      const usage = this.getMemoryUsage();
      
      if (this.isMemoryHigh()) {
        console.warn('Memory usage high:', Math.round(usage.percentage * 100), '%');
        this.forceGC();
        this.clearCaches();
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }
}

export const memoryOptimizer = new MemoryOptimizer();
