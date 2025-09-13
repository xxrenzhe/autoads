import { Cron } from 'croner'
import { prisma } from '@/lib/prisma'
import { SubscriptionExpirationService } from './subscription-expiration-service'
import { SubscriptionNotificationService } from './subscription-notification-service'
import { SubscriptionQuotaService } from './subscription-quota-service'

export interface ScheduledTask {
  id: string
  name: string
  schedule: string
  handler: () => Promise<void>
  enabled: boolean
  lastRun?: Date
  nextRun?: Date
  timezone?: string
}

export class ScheduledTaskService {
  private static instance: ScheduledTaskService
  private tasks: Map<string, ScheduledTask> = new Map()
  private cronJobs: Map<string, Cron> = new Map()
  private isRunning: boolean = false

  private constructor() {}

  static getInstance(): ScheduledTaskService {
    if (!ScheduledTaskService.instance) {
      ScheduledTaskService.instance = new ScheduledTaskService()
    }
    return ScheduledTaskService.instance
  }

  /**
   * Register a new scheduled task
   */
  registerTask(task: Omit<ScheduledTask, 'lastRun' | 'nextRun'>): void {
    const fullTask: ScheduledTask = {
      ...task,
      lastRun: undefined,
      nextRun: undefined
    }

    this.tasks.set(task.id, fullTask)

    if (task.enabled) {
      this.scheduleTask(task.id)
    }

    console.log(`[ScheduledTaskService] Registered task: ${task.name} (${task.id})`)
  }

  /**
   * Schedule a task using Croner
   */
  private scheduleTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    // Remove existing cron job if any
    this.unscheduleTask(taskId)

    // Create new cron job
    const cronJob = new Cron(
      task.schedule,
      {
        timezone: task.timezone || 'Asia/Shanghai',
        protect: true, // Prevent overlapping executions
        maxRuns: 0, // Unlimited runs
      },
      async () => {
        await this.executeTask(taskId)
      }
    )

    this.cronJobs.set(taskId, cronJob)
    
    // Update next run time
    const nextRun = cronJob.nextRun()
    task.nextRun = nextRun ? new Date(nextRun) : undefined

    console.log(`[ScheduledTaskService] Scheduled task: ${task.name} - Next run: ${task.nextRun?.toISOString()}`)
  }

  /**
   * Unschedule a task
   */
  private unscheduleTask(taskId: string): void {
    const cronJob = this.cronJobs.get(taskId)
    if (cronJob) {
      cronJob.stop()
      this.cronJobs.delete(taskId)
    }
  }

  /**
   * Execute a task
   */
  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) return

    const startTime = Date.now()
    console.log(`[ScheduledTaskService] Starting task: ${task.name} (${taskId})`)

    try {
      // Log task start
      await this.logTaskExecution(taskId, 'started')
      
      await task.handler()
      
      // Update last run time
      task.lastRun = new Date()
      
      // Log task completion
      const duration = Date.now() - startTime
      await this.logTaskExecution(taskId, 'completed', { duration })
      
      console.log(`[ScheduledTaskService] Completed task: ${task.name} in ${duration}ms`)
    } catch (error) {
      // Log task error
      await this.logTaskExecution(taskId, 'error', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      console.error(`[ScheduledTaskService] Error in task ${task.name}:`, error)
    }
  }

  /**
   * Log task execution to database
   */
  private async logTaskExecution(taskId: string, status: 'started' | 'completed' | 'error', metadata?: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'scheduled_task_execution',
          resource: 'system',
          severity: status === 'error' ? 'error' : 'info',
          category: 'system',
          outcome: status,
          details: {
            taskId,
            status,
            timestamp: new Date().toISOString(),
            ...metadata
          }
        }
      })
    } catch (error) {
      console.error('[ScheduledTaskService] Failed to log task execution:', error)
    }
  }

  /**
   * Start all enabled tasks
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    console.log('[ScheduledTaskService] Starting scheduled task service...')
    
    // Log service start
    try {
      await prisma.auditLog.create({
        data: {
          action: 'service_start',
          resource: 'scheduled_task_service',
          severity: 'info',
          category: 'system',
          outcome: 'success',
          details: {
            message: 'Scheduled task service started',
            timestamp: new Date().toISOString(),
            tasksCount: this.tasks.size,
            enabledTasks: Array.from(this.tasks.entries())
              .filter(([_, task]: any) => task.enabled)
              .map(([id, _]: any) => id)
          }
        }
      })
    } catch (error) {
      console.error('[ScheduledTaskService] Failed to log service start:', error)
    }
    
    this.tasks.forEach((task, id: any) => {
      if (task.enabled) {
        this.scheduleTask(id)
      }
    })

    this.isRunning = true
    console.log('[ScheduledTaskService] Service started')
  }

  /**
   * Stop all tasks
   */
  stop(): void {
    if (!this.isRunning) return

    console.log('[ScheduledTaskService] Stopping scheduled task service...')
    
    this.cronJobs.forEach((cronJob: any) => {
      cronJob.stop()
    })
    
    this.cronJobs.clear()
    this.isRunning = false
    console.log('[ScheduledTaskService] Service stopped')
  }

  /**
   * Enable a task
   */
  enableTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task && !task.enabled) {
      task.enabled = true
      this.scheduleTask(taskId)
      console.log(`[ScheduledTaskService] Enabled task: ${task.name}`)
    }
  }

  /**
   * Disable a task
   */
  disableTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task && task.enabled) {
      task.enabled = false
      this.unscheduleTask(taskId)
      console.log(`[ScheduledTaskService] Disabled task: ${task.name}`)
    }
  }

  /**
   * Manually trigger a task
   */
  async triggerTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    console.log(`[ScheduledTaskService] Manually triggering task: ${task.name}`)
    await this.executeTask(taskId)
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null
  }

  /**
   * Get all tasks status
   */
  getAllTasksStatus(): ScheduledTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * Initialize default tasks
   */
  initializeDefaultTasks(): void {
    // Register subscription expiration task
    this.registerTask({
      id: 'subscription-expiration',
      name: 'Process Expired Subscriptions',
      schedule: '0 0 * * *', // Run daily at midnight
      enabled: true,
      timezone: 'Asia/Shanghai',
      handler: async () => {
        const results = await SubscriptionExpirationService.processExpiredSubscriptions()
        console.log(`[ScheduledTaskService] Processed ${results.length} expired subscriptions`)
      }
    })

    // Register invitation cleanup task (optional - cleanup old invitation tracking data)
    this.registerTask({
      id: 'invitation-cleanup',
      name: 'Clean Up Old Invitation Data',
      schedule: '0 2 * * 0', // Run weekly on Sunday at 2 AM
      enabled: true,
      timezone: 'Asia/Shanghai',
      handler: async () => {
        // Clean up user activity records older than 90 days
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - 90)
        
        const deleted = await prisma.userActivity.deleteMany({
          where: {
            action: 'INVITATION_LINK_CLICK',
            createdAt: {
              lt: cutoffDate
            }
          }
        })
        
        console.log(`[ScheduledTaskService] Cleaned up ${deleted.count} old invitation activity records`)
      }
    })

    // Register subscription notification task
    this.registerTask({
      id: 'subscription-notifications',
      name: 'Process Subscription Notifications',
      schedule: '0 9 * * *', // Run daily at 9 AM
      enabled: true,
      timezone: 'Asia/Shanghai',
      handler: async () => {
        await SubscriptionNotificationService.processPendingNotifications()
        console.log('[ScheduledTaskService] Processed subscription notifications')
      }
    })

    // Register quota reset task
    this.registerTask({
      id: 'quota-reset',
      name: 'Reset Monthly Quotas',
      schedule: '0 0 1 * *', // Run at midnight on first day of month
      enabled: true,
      timezone: 'Asia/Shanghai',
      handler: async () => {
        await SubscriptionQuotaService.resetMonthlyQuotas()
        console.log('[ScheduledTaskService] Monthly quotas reset')
      }
    })

    console.log('[ScheduledTaskService] Initialized default tasks')
  }
}