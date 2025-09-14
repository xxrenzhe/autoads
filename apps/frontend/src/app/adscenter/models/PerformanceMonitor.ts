/**
 * 简化的性能监控器 - 用于构建过程
 */

export class PerformanceMonitor {
  async startMonitoring(taskId: string): Promise<void> {
    // 简化实现用于构建
  }

  async endMonitoring(taskId: string): Promise<any> {
    // 简化实现用于构建
    return {
      duration: 1000,
      memoryUsage: 50,
      success: true
    };
  }

  async getMetrics(): Promise<any[]> {
    // 简化实现用于构建
    return [];
  }
}