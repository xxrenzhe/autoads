// 预发/本地最小桩：提供任务调度服务的空实现，避免构建报错

type TaskStatus = {
  id: string
  name: string
  schedule: string
  enabled: boolean
  lastRun?: string | null
  nextRun?: string | null
  timezone?: string
}

class ScheduledTaskServiceStub {
  private running = false
  private tasks: TaskStatus[] = [
    { id: 'cleanup_logs', name: '清理日志', schedule: '0 3 * * *', enabled: false, timezone: 'UTC' },
    { id: 'sync_metrics', name: '同步指标', schedule: '*/15 * * * *', enabled: false, timezone: 'UTC' },
  ]

  start() { this.running = true }
  stop() { this.running = false }
  isRunning() { return this.running }

  getAllTasksStatus(): TaskStatus[] { return this.tasks.slice() }

  enableTask(id: string) {
    const t = this.tasks.find(x => x.id === id)
    if (t) t.enabled = true
  }
  disableTask(id: string) {
    const t = this.tasks.find(x => x.id === id)
    if (t) t.enabled = false
  }
  async triggerTask(id: string) {
    const t = this.tasks.find(x => x.id === id)
    if (t) {
      const now = new Date()
      t.lastRun = now.toISOString()
      t.nextRun = null
    }
  }
}

export const taskService = new ScheduledTaskServiceStub()

