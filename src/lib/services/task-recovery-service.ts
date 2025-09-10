import { prisma } from '@/lib/prisma';
import { ScheduledTaskService } from './scheduled-task-service';

/**
 * Service to handle missed scheduled tasks after server restart
 */
export class TaskRecoveryService {
  /**
   * Check for and recover missed subscription expiration checks
   */
  static async recoverMissedExpirationChecks() {
    try {
      console.log('[TaskRecoveryService] Checking for missed subscription expiration checks...');
      
      // Get the last execution time from system logs or database
      const lastExecution = await this.getLastTaskExecution('subscription-expiration');
      
      if (!lastExecution) {
        console.log('[TaskRecoveryService] No previous execution found, skipping recovery');
        return;
      }
      
      const now = new Date();
      const hoursSinceLastExecution = (now.getTime() - lastExecution.getTime()) / (1000 * 60 * 60);
      
      // If more than 24 hours have passed, we might have missed daily executions
      if (hoursSinceLastExecution > 24) {
        console.log(`[TaskRecoveryService] Detected ${Math.floor(hoursSinceLastExecution)} hours since last execution, triggering recovery check`);
        
        // Import here to avoid circular dependency
        const { SubscriptionExpirationService } = await import('./subscription-expiration-service');
        
        // Trigger the expiration check
        const results = await SubscriptionExpirationService.processExpiredSubscriptions();
        console.log(`[TaskRecoveryService] Recovery check completed, processed ${results.length} subscriptions`);
        
        // Update the last execution time
        await this.updateTaskExecution('subscription-expiration');
      }
    } catch (error) {
      console.error('[TaskRecoveryService] Error in recovery process:', error);
    }
  }
  
  /**
   * Get the last execution time for a task
   */
  private static async getLastTaskExecution(taskId: string): Promise<Date | null> {
    try {
      // Try to get the latest successful execution from database
      const executionRecord = await prisma.auditLog.findFirst({
        where: {
          action: 'scheduled_task_execution',
          AND: [
            {
              details: {
                path: ['taskId'],
                equals: taskId
              }
            },
            {
              OR: [
                {
                  details: {
                    path: ['status'],
                    equals: 'completed'
                  }
                },
                {
                  details: {
                    path: ['status'],
                    equals: 'started'
                  }
                }
              ]
            }
          ]
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
      
      if (executionRecord) {
        return executionRecord.timestamp;
      }
      
      // If no execution records found, check when the service was last started
      const serviceStartRecord = await prisma.auditLog.findFirst({
        where: {
          action: 'service_start',
          resource: 'scheduled_task_service'
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
      
      if (serviceStartRecord) {
        // If service started recently but no task executions, it might be a new deployment
        const hoursSinceStart = (Date.now() - serviceStartRecord.timestamp.getTime()) / (1000 * 60 * 60);
        if (hoursSinceStart < 1) {
          return serviceStartRecord.timestamp;
        }
      }
      
      // Fallback: check for expired subscriptions that should have been processed
      const oldestExpired = await prisma.subscription.findFirst({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: {
            lt: new Date()
          }
        },
        orderBy: {
          currentPeriodEnd: 'asc'
        }
      });
      
      if (oldestExpired) {
        // If we found expired subscriptions, assume the last check was before they expired
        return new Date(oldestExpired.currentPeriodEnd.getTime() - 24 * 60 * 60 * 1000);
      }
      
      // Last resort: assume last execution was at the expected schedule time
      const now = new Date();
      const lastScheduled = new Date(now);
      lastScheduled.setDate(lastScheduled.getDate() - 1);
      lastScheduled.setHours(0, 0, 0, 0); // Set to midnight
      
      return lastScheduled;
    } catch (error) {
      console.error('Error getting last task execution:', error);
      return null;
    }
  }
  
  /**
   * Update the last execution time for a task
   */
  private static async updateTaskExecution(taskId: string, additionalMetadata?: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'scheduled_task_execution',
          resource: 'system',
          severity: 'info',
          category: 'system',
          outcome: 'recovered',
          details: {
            message: `Task ${taskId} execution recovered`,
            taskId,
            executedAt: new Date().toISOString(),
            autoRecovered: true,
            ...additionalMetadata
          }
        }
      });
    } catch (error) {
      console.error('Error updating task execution:', error);
    }
  }
  
  /**
   * Initialize recovery process on application startup
   */
  static async initialize() {
    // Wait a bit for the application to fully start and database to be ready
    setTimeout(async () => {
      console.log('[TaskRecoveryService] Starting task recovery initialization...');
      
      // Check for all scheduled tasks that might have missed executions
      await this.recoverAllMissedTasks();
      
      console.log('[TaskRecoveryService] Task recovery initialization completed');
    }, 10000); // 10 seconds delay to ensure everything is ready
  }

  /**
   * Check for and recover all missed scheduled tasks
   */
  private static async recoverAllMissedTasks() {
    try {
      // Check subscription expiration task
      await this.recoverMissedExpirationChecks();
      
      // Check quota reset task (runs monthly on 1st day)
      await this.recoverMissedQuotaResets();
      
      // Check notification task (runs daily)
      await this.recoverMissedNotifications();
      
    } catch (error) {
      console.error('[TaskRecoveryService] Error in task recovery:', error);
    }
  }

  /**
   * Check for missed quota reset operations
   */
  private static async recoverMissedQuotaResets() {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Get last quota reset execution
      const lastReset = await this.getLastTaskExecution('quota-reset');
      
      if (!lastReset) {
        console.log('[TaskRecoveryService] No previous quota reset found, checking if needed');
        return;
      }
      
      const lastResetMonth = lastReset.getMonth();
      const lastResetYear = lastReset.getFullYear();
      
      // Check if we missed any month resets
      const monthsMissed = (currentYear - lastResetYear) * 12 + (currentMonth - lastResetMonth);
      
      if (monthsMissed > 0 && now.getDate() <= 7) { // Only recover in first week of month
        console.log(`[TaskRecoveryService] Detected ${monthsMissed} missed quota resets, triggering recovery`);
        
        const { SubscriptionQuotaService } = await import('./subscription-quota-service');
        await SubscriptionQuotaService.resetMonthlyQuotas();
        
        // Log the recovery
        await this.updateTaskExecution('quota-reset', { 
          monthsMissed,
          recovered: true 
        });
      }
    } catch (error) {
      console.error('[TaskRecoveryService] Error in quota reset recovery:', error);
    }
  }

  /**
   * Check for missed notification processing
   */
  private static async recoverMissedNotifications() {
    try {
      const lastExecution = await this.getLastTaskExecution('subscription-notifications');
      
      if (!lastExecution) {
        console.log('[TaskRecoveryService] No previous notification execution found, skipping recovery');
        return;
      }
      
      const now = new Date();
      const hoursSinceLastExecution = (now.getTime() - lastExecution.getTime()) / (1000 * 60 * 60);
      
      // If more than 24 hours have passed, we might have missed daily notifications
      if (hoursSinceLastExecution > 24) {
        console.log(`[TaskRecoveryService] Detected ${Math.floor(hoursSinceLastExecution)} hours since last notification check, triggering recovery`);
        
        const { SubscriptionNotificationService } = await import('./subscription-notification-service');
        await SubscriptionNotificationService.processPendingNotifications();
        
        // Log the recovery
        await this.updateTaskExecution('subscription-notifications', { 
          hoursSinceLastExecution: Math.floor(hoursSinceLastExecution),
          recovered: true 
        });
      }
    } catch (error) {
      console.error('[TaskRecoveryService] Error in notification recovery:', error);
    }
  }
}