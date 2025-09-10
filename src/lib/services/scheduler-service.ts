import { TrialService } from './trial-service'

/**
 * 调度器服务 - 处理定时任务
 */
export class SchedulerService {
  private static intervals: Map<string, NodeJS.Timeout> = new Map()

  /**
   * 启动所有定时任务
   */
  static startScheduler() {
    console.log('Starting scheduler service...')
    
    // 启动试用期过期检查 - 每小时检查一次
    this.scheduleTrialExpirationCheck()
    
    console.log('Scheduler service started successfully')
  }

  /**
   * 停止所有定时任务
   */
  static stopScheduler() {
    console.log('Stopping scheduler service...')
    
    this.intervals.forEach((interval, name) => {
      clearInterval(interval)
      console.log(`Stopped scheduler: ${name}`)
    })
    
    this.intervals.clear()
    console.log('Scheduler service stopped')
  }

  /**
   * 调度试用期过期检查
   */
  private static scheduleTrialExpirationCheck() {
    const taskName = 'trial-expiration-check'
    
    // 清除现有的调度（如果存在）
    if (this.intervals.has(taskName)) {
      clearInterval(this.intervals.get(taskName)!)
    }

    // 立即执行一次
    this.runTrialExpirationCheck()

    // 每小时执行一次（3600000毫秒）
    const interval = setInterval(() => {
      this.runTrialExpirationCheck()
    }, 60 * 60 * 1000) // 1 hour

    this.intervals.set(taskName, interval)
    console.log('Scheduled trial expiration check to run every hour')
  }

  /**
   * 执行试用期过期检查
   */
  private static async runTrialExpirationCheck() {
    try {
      console.log('Running scheduled trial expiration check...')
      await TrialService.checkTrialExpiration()
      console.log('Scheduled trial expiration check completed successfully')
    } catch (error) {
      console.error('Error in scheduled trial expiration check:', error)
    }
  }

  /**
   * 手动触发试用期过期检查
   */
  static async triggerTrialExpirationCheck() {
    console.log('Manually triggering trial expiration check...')
    await this.runTrialExpirationCheck()
  }

  /**
   * 获取调度器状态
   */
  static getSchedulerStatus() {
    return {
      isRunning: this.intervals.size > 0,
      activeSchedules: Array.from(this.intervals.keys()),
      startTime: new Date().toISOString()
    }
  }
}

// 在服务器启动时自动启动调度器（仅在生产环境）
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  // 延迟启动，确保数据库连接已建立
  setTimeout(() => {
    SchedulerService.startScheduler()
  }, 5000) // 5秒延迟

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, stopping scheduler...')
    SchedulerService.stopScheduler()
  })

  process.on('SIGINT', () => {
    console.log('Received SIGINT, stopping scheduler...')
    SchedulerService.stopScheduler()
  })
}