/**
 * 全局状态管理器
 * 统一管理全局变量，避免重复声明和散乱的状态管理
 */

export class GlobalStateManager {
  private static instance: GlobalStateManager;
  
  // 任务终止标志
  private terminateFlags: Map<string, { timestamp: number; forced: boolean }> = new Map();
  
  // 任务执行状态标志
  private executionFlags: Map<string, { startTime: number; active: boolean }> = new Map();
  
  // 清理定时器
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.initializeCleanup();
  }
  
  public static getInstance(): GlobalStateManager {
    if (!GlobalStateManager.instance) {
      GlobalStateManager.instance = new GlobalStateManager();
    }
    return GlobalStateManager.instance;
  }
  
  /**
   * 设置任务终止标志
   */
  public setTerminateFlag(taskId: string, forced: boolean = false): void {
    this.terminateFlags.set(taskId, {
      timestamp: Date.now(),
      forced
    });
  }
  
  /**
   * 检查任务是否终止
   */
  public isTaskTerminated(taskId: string): boolean {
    const flag = this.terminateFlags.get(taskId);
    if (flag && flag.forced) {
      return true;
    }
    return false;
  }
  
  /**
   * 清除任务终止标志
   */
  public clearTerminateFlag(taskId: string): void {
    this.terminateFlags.delete(taskId);
  }
  
  /**
   * 设置任务执行状态
   */
  public setExecutionFlag(taskId: string, active: boolean): void {
    this.executionFlags.set(taskId, {
      startTime: Date.now(),
      active
    });
  }
  
  /**
   * 检查任务是否在执行中
   */
  public isTaskExecuting(taskId: string): boolean {
    const flag = this.executionFlags.get(taskId);
    return flag ? flag.active : false;
  }
  
  /**
   * 清除任务执行标志
   */
  public clearExecutionFlag(taskId: string): void {
    this.executionFlags.delete(taskId);
  }
  
  /**
   * 获取所有执行中的任务
   */
  public getExecutingTasks(): string[] {
    return Array.from(this.executionFlags.entries())
      .filter(([_, flag]: any) => flag.active)
      .map(([taskId, _]: any) => taskId);
  }
  
  /**
   * 初始化清理定时器
   */
  private initializeCleanup(): void {
    // 仅在服务端运行
    if (typeof window === 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredFlags();
      }, 10 * 60 * 1000); // 每10分钟清理一次
    }
  }
  
  /**
   * 清理过期标志
   */
  private cleanupExpiredFlags(): void {
    const now = Date.now();
    const expireTime = 30 * 60 * 1000; // 30分钟
    
    // 清理终止标志
    let cleanedTerminateCount = 0;
    for (const [taskId, flag] of this.terminateFlags) {
      if (now - flag.timestamp > expireTime) {
        this.terminateFlags.delete(taskId);
        cleanedTerminateCount++;
      }
    }
    
    // 清理执行标志（长时间未活动的）
    let cleanedExecutionCount = 0;
    for (const [taskId, flag] of this.executionFlags) {
      if (now - flag.startTime > expireTime) {
        this.executionFlags.delete(taskId);
        cleanedExecutionCount++;
      }
    }
    
    if (cleanedTerminateCount > 0 || cleanedExecutionCount > 0) {
      console.log(`[GlobalStateManager] 清理过期标志: 终止${cleanedTerminateCount}个, 执行${cleanedExecutionCount}个`);
    }
  }
  
  /**
   * 销毁实例，清理定时器
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.terminateFlags.clear();
    this.executionFlags.clear();
  }
}

// 导出单例实例
export const globalStateManager = GlobalStateManager.getInstance();

// 为了向后兼容，导出全局变量访问器
export function getGlobalTerminateFlags(): Map<string, { timestamp: number; forced: boolean }> {
  return globalStateManager['terminateFlags'];
}

export function getGlobalTaskExecutionFlags(): Map<string, { startTime: number; active: boolean }> {
  return globalStateManager['executionFlags'];
}