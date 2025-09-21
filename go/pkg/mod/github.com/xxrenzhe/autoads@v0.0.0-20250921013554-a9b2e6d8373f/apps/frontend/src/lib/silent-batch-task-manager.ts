/**
 * 静默批量任务管理（最小兼容层）
 * - 本地状态已下线：不在 Next 进程中存储任务状态，统一交由 Go 维护
 * - 保留方法签名，以兼容旧代码；内部为 no-op 或透传后端
 */

export class SilentBatchTaskManager {
  private static instance: SilentBatchTaskManager;
  private constructor() {}
  static getInstance(): SilentBatchTaskManager {
    if (!SilentBatchTaskManager.instance) SilentBatchTaskManager.instance = new SilentBatchTaskManager()
    return SilentBatchTaskManager.instance
  }

  async setTask(_taskId: string, _status: any): Promise<void> { /* no-op */ }
  getTask(_taskId: string) { return undefined }
  async getTaskSafe(_taskId: string): Promise<any | undefined> { return undefined }
  removeTask(_taskId: string) { return false }
  getAllTasks() { return [] as any[] }
  cleanupExpiredTasks() { /* no-op */ }
  aggressiveCleanup(): number { return 0 }
  monitorMemoryUsage() { /* no-op */ }
  getTaskStats() { return { total: 0, byStatus: {}, memoryUsage: 'low' } }
  async terminateTask(taskId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/batchopen/silent-terminate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ taskId }) })
      return res.ok
    } catch { return false }
  }
}

export const silentBatchTaskManager = SilentBatchTaskManager.getInstance()

