import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createLogger('GoogleAdsUpdateScheduler');

export interface ScheduleConfig {
  id: string;
  name: string;
  accountId: string;
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM format
  timezone: string;
  startDate?: Date;
  endDate?: Date;
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
  daysOfMonth?: number[]; // 1-31 for day of month
  conditions: {
    minConfidence?: number;
    maxUpdates?: number;
    dryRun?: boolean;
    validateOnly?: boolean;
    includePaused?: boolean;
    campaignIds?: string[];
    adGroupIds?: string[];
    adTypes?: string[];
  };
  notifications: {
    onSuccess?: boolean;
    onFailure?: boolean;
    emailRecipients?: string[];
    webhookUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  runHistory: ScheduleRunResult[];
}

export interface ScheduleRunResult {
  id: string;
  scheduleId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  totalAds: number;
  updatedAds: number;
  failedAds: number;
  skippedAds: number;
  processingTime: number;
  errors: string[];
  warnings: string[];
  summary: {
    averageConfidence: number;
    topUpdatedCampaigns: Array<{
      campaignId: string;
      campaignName: string;
      updateCount: number;
    }>;
  };
}

export interface ManualTriggerOptions {
  accountId: string;
  campaignIds?: string[];
  adGroupIds?: string[];
  adIds?: string[];
  dryRun?: boolean;
  validateOnly?: boolean;
  maxUpdates?: number;
  forceUpdate?: boolean;
  includePaused?: boolean;
  confidenceThreshold?: number;
}

export interface TriggerResult {
  id: string;
  triggerType: 'manual' | 'scheduled';
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  accountId: string;
  totalAds: number;
  updatedAds: number;
  failedAds: number;
  skippedAds: number;
  processingTime: number;
  errors: string[];
  warnings: string[];
  summary: {
    averageConfidence: number;
    campaignsUpdated: number;
    adGroupsUpdated: number;
  };
}

export class GoogleAdsUpdateScheduler {
  private schedules: Map<string, ScheduleConfig> = new Map();
  private runningJobs: Map<string, ScheduleRunResult> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private manualTriggers: Map<string, TriggerResult> = new Map();

  constructor() {
    this.startScheduler();
  }

  /**
   * Create a new update schedule
   */
  async createSchedule(config: Omit<ScheduleConfig, 'id' | 'createdAt' | 'updatedAt' | 'runHistory'>): Promise<ScheduleConfig> {
    try {
      const schedule: ScheduleConfig = {
        ...config,
        id: Math.random().toString(36).substring(7),
        createdAt: new Date(),
        updatedAt: new Date(),
        runHistory: [],
        nextRun: this.calculateNextRun(config as ScheduleConfig),
      };

      this.schedules.set(schedule.id, schedule);
      
      if (schedule.enabled) {
        this.scheduleJob(schedule);
      }

      await this.saveSchedule(schedule);

      logger.info('Schedule created successfully', {
        scheduleId: schedule.id,
        accountId: schedule.accountId,
        frequency: schedule.frequency,
      });

      return schedule;
    } catch (error) {
      logger.error('Failed to create schedule', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): Promise<ScheduleConfig> {
    try {
      const schedule = this.schedules.get(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }

      const updatedSchedule: ScheduleConfig = {
        ...schedule,
        ...updates,
        updatedAt: new Date(),
        nextRun: this.calculateNextRun({ ...schedule, ...updates } as ScheduleConfig),
      };

      this.schedules.set(scheduleId, updatedSchedule);

      // Reschedule if enabled or timing changed
      if (updates.enabled !== undefined || updates.frequency || updates.time || updates.timezone) {
        this.unscheduleJob(scheduleId);
        if (updatedSchedule.enabled) {
          this.scheduleJob(updatedSchedule);
        }
      }

      await this.saveSchedule(updatedSchedule);

      logger.info('Schedule updated successfully', {
        scheduleId,
        accountId: updatedSchedule.accountId,
        enabled: updatedSchedule.enabled,
      });

      return updatedSchedule;
    } catch (error) {
      logger.error('Failed to update schedule', new EnhancedError('Failed to update schedule', { scheduleId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    try {
      const schedule = this.schedules.get(scheduleId);
      if (!schedule) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }

      // Cancel any running job
      if (this.runningJobs.has(scheduleId)) {
        await this.cancelRunningJob(scheduleId);
      }

      // Remove scheduled timer
      this.unscheduleJob(scheduleId);

      this.schedules.delete(scheduleId);

      // Remove from persistent storage
      await this.removeScheduleFromStorage(scheduleId);

      logger.info('Schedule deleted successfully', { scheduleId });
    } catch (error) {
      logger.error('Failed to delete schedule', new EnhancedError('Failed to delete schedule', { scheduleId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Trigger manual update
   */
  async triggerManualUpdate(options: ManualTriggerOptions): Promise<TriggerResult> {
    const triggerId = Math.random().toString(36).substring(7);
    const startTime = new Date();

    try {
      logger.info('Manual update triggered', {
        triggerId,
        accountId: options.accountId,
        options,
      });

      const result: TriggerResult = {
        id: triggerId,
        triggerType: 'manual',
        startTime,
        status: 'running',
        accountId: options.accountId,
        totalAds: 0,
        updatedAds: 0,
        failedAds: 0,
        skippedAds: 0,
        processingTime: 0,
        errors: [],
        warnings: [],
        summary: {
          averageConfidence: 0,
          campaignsUpdated: 0,
          adGroupsUpdated: 0,
        },
      };

      this.manualTriggers.set(triggerId, result);

      // Execute the update
      const updateResult = await this.executeUpdate(options);

      const endTime = new Date();
      const processingTime = endTime.getTime() - startTime.getTime();

      const finalResult: TriggerResult = {
        ...result,
        endTime,
        status: updateResult.success ? 'completed' : 'failed',
        totalAds: updateResult.totalAds,
        updatedAds: updateResult.updatedAds,
        failedAds: updateResult.failedAds,
        skippedAds: updateResult.skippedAds,
        processingTime,
        errors: updateResult.errors,
        warnings: updateResult.warnings,
        summary: {
          averageConfidence: updateResult.averageConfidence,
          campaignsUpdated: updateResult.campaignsUpdated,
          adGroupsUpdated: updateResult.adGroupsUpdated,
        },
      };

      this.manualTriggers.set(triggerId, finalResult);

      logger.info('Manual update completed', {
        triggerId,
        accountId: options.accountId,
        success: updateResult.success,
        updatedAds: updateResult.updatedAds,
        processingTime,
      });

      return finalResult;
    } catch (error) {
      const endTime = new Date();
      const processingTime = endTime.getTime() - startTime.getTime();
      const errorMsg = error instanceof Error ? error.message : "Unknown error" as any;

      const failedResult: TriggerResult = {
        id: triggerId,
        triggerType: 'manual',
        startTime,
        endTime,
        status: 'failed',
        accountId: options.accountId,
        totalAds: 0,
        updatedAds: 0,
        failedAds: 0,
        skippedAds: 0,
        processingTime,
        errors: [errorMsg],
        warnings: [],
        summary: {
          averageConfidence: 0,
          campaignsUpdated: 0,
          adGroupsUpdated: 0,
        },
      };

      this.manualTriggers.set(triggerId, failedResult);

      logger.error('Manual update failed', new EnhancedError('Manual update failed', { 
        triggerId,
        accountId: options.accountId,
        error: errorMsg,
       }));

      throw error;
    }
  }

  /**
   * Get all schedules
   */
  getSchedules(accountId?: string): ScheduleConfig[] {
    const schedules = Array.from(this.schedules.values());
    return accountId ? schedules.filter(s => s.accountId === accountId) : schedules;
  }

  /**
   * Get schedule by ID
   */
  getSchedule(scheduleId: string): ScheduleConfig | null {
    return this.schedules.get(scheduleId) || null;
  }

  /**
   * Get running jobs
   */
  getRunningJobs(): ScheduleRunResult[] {
    return Array.from(this.runningJobs.values());
  }

  /**
   * Get manual trigger results
   */
  getManualTriggers(accountId?: string): TriggerResult[] {
    const triggers = Array.from(this.manualTriggers.values());
    return accountId ? triggers.filter(t => t.accountId === accountId) : triggers;
  }

  /**
   * Cancel a running job
   */
  async cancelRunningJob(scheduleId: string): Promise<void> {
    try {
      const job = this.runningJobs.get(scheduleId);
      if (!job) {
        throw new Error(`No running job found for schedule ${scheduleId}`);
      }

      job.status = 'cancelled';
      job.endTime = new Date();

      this.runningJobs.delete(scheduleId);

      logger.info('Job cancelled', { scheduleId });

      // Update schedule with cancelled run
      const schedule = this.schedules.get(scheduleId);
      if (schedule) {
        schedule.runHistory.push(job);
        schedule.lastRun = job.endTime;
        await this.saveSchedule(schedule);
      }
    } catch (error) {
      logger.error('Failed to cancel running job', new EnhancedError('Failed to cancel running job', { scheduleId, error: error instanceof Error ? error.message : String(error) }));
      throw error;
    }
  }

  /**
   * Get scheduler statistics
   */
  getSchedulerStats(): {
    totalSchedules: number;
    enabledSchedules: number;
    runningJobs: number;
    todayRuns: number;
    successRate: number;
    averageProcessingTime: number;
  } {
    const schedules = Array.from(this.schedules.values());
    const enabledSchedules = schedules.filter(s => s.enabled).length;
    const runningJobs = this.runningJobs.size;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRuns = schedules.reduce((count, schedule) => {
      return count + schedule.runHistory.filter(run => {
        const runDate = new Date(run.startTime);
        runDate.setHours(0, 0, 0, 0);
        return runDate.getTime() === today.getTime();
      }).length;
    }, 0);

    const allRuns = schedules.flatMap(s => s.runHistory);
    const successfulRuns = allRuns.filter(r => r.status === 'completed').length;
    const successRate = allRuns.length > 0 ? (successfulRuns / allRuns.length) * 100 : 0;
    
    const averageProcessingTime = allRuns.length > 0 
      ? allRuns.reduce((sum, r) => sum + r.processingTime, 0) / allRuns.length 
      : 0;

    return {
      totalSchedules: schedules.length,
      enabledSchedules,
      runningJobs,
      todayRuns,
      successRate,
      averageProcessingTime,
    };
  }

  // Private methods

  private startScheduler(): void {
    logger.info('Google Ads Update Scheduler started');
    
    // Load existing schedules from storage
    this.loadSchedules();
    
    // Schedule all enabled jobs
    this.schedules.forEach(schedule => {
      if (schedule.enabled) {
        this.scheduleJob(schedule);
      }
    });

    // Start cleanup timer
    this.startCleanupTimer();
  }

  private scheduleJob(schedule: ScheduleConfig): void {
    if (!schedule.nextRun) {
      return;
    }

    const now = new Date();
    const delay = schedule.nextRun.getTime() - now.getTime();

    if (delay > 0) {
      const timer = setTimeout(() => {
        this.executeScheduledJob(schedule.id);
      }, delay);

      this.timers.set(schedule.id, timer);

      logger.info('Job scheduled', {
        scheduleId: schedule.id,
        runTime: schedule.nextRun,
        delay,
      });
    } else {
      // Schedule is overdue, run immediately
      this.executeScheduledJob(schedule.id);
    }
  }

  private unscheduleJob(scheduleId: string): void {
    const timer = this.timers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(scheduleId);
      logger.info('Job unscheduled', { scheduleId });
    }
  }

  private async executeScheduledJob(scheduleId: string): Promise<void> {
    try {
      const schedule = this.schedules.get(scheduleId);
      if (!schedule || !schedule.enabled) {
        return;
      }

      logger.info('Executing scheduled job', {
        scheduleId,
        accountId: schedule.accountId,
      });

      const runId = Math.random().toString(36).substring(7);
      const startTime = new Date();

      const runResult: ScheduleRunResult = {
        id: runId,
        scheduleId,
        startTime,
        status: 'running',
        totalAds: 0,
        updatedAds: 0,
        failedAds: 0,
        skippedAds: 0,
        processingTime: 0,
        errors: [],
        warnings: [],
        summary: {
          averageConfidence: 0,
          topUpdatedCampaigns: [],
        },
      };

      this.runningJobs.set(scheduleId, runResult);

      // Execute the update
      const updateResult = await this.executeUpdate({
        accountId: schedule.accountId,
        campaignIds: schedule.conditions.campaignIds,
        adGroupIds: schedule.conditions.adGroupIds,
        dryRun: schedule.conditions.dryRun,
        validateOnly: schedule.conditions.validateOnly,
        maxUpdates: schedule.conditions.maxUpdates,
        includePaused: schedule.conditions.includePaused,
        confidenceThreshold: schedule.conditions.minConfidence,
      });

      const endTime = new Date();
      const processingTime = endTime.getTime() - startTime.getTime();

      const finalRunResult: ScheduleRunResult = {
        ...runResult,
        endTime,
        status: updateResult.success ? 'completed' : 'failed',
        totalAds: updateResult.totalAds,
        updatedAds: updateResult.updatedAds,
        failedAds: updateResult.failedAds,
        skippedAds: updateResult.skippedAds,
        processingTime,
        errors: updateResult.errors,
        warnings: updateResult.warnings,
        summary: {
          averageConfidence: updateResult.averageConfidence,
          topUpdatedCampaigns: updateResult.topUpdatedCampaigns,
        },
      };

      this.runningJobs.delete(scheduleId);

      // Update schedule
      schedule.lastRun = endTime;
      schedule.nextRun = this.calculateNextRun(schedule);
      schedule.runHistory.push(finalRunResult);
      
      // Keep only last 100 runs
      if (schedule.runHistory.length > 100) {
        schedule.runHistory = schedule.runHistory.slice(-100);
      }

      await this.saveSchedule(schedule);

      // Send notifications
      if (schedule.notifications.onSuccess && updateResult.success) {
        await this.sendSuccessNotification(schedule, finalRunResult);
      }
      
      if (schedule.notifications.onFailure && !updateResult.success) {
        await this.sendFailureNotification(schedule, finalRunResult);
      }

      // Schedule next run
      if (schedule.enabled && schedule.nextRun) {
        this.scheduleJob(schedule);
      }

      logger.info('Scheduled job completed', {
        scheduleId,
        accountId: schedule.accountId,
        success: updateResult.success,
        updatedAds: updateResult.updatedAds,
        processingTime,
      });
    } catch (error) {
      logger.error('Scheduled job failed', new EnhancedError('Scheduled job failed', { scheduleId, error: error instanceof Error ? error.message : String(error) }));
      
      const schedule = this.schedules.get(scheduleId);
      if (schedule) {
        const failedRun: ScheduleRunResult = {
          id: Math.random().toString(36).substring(7),
          scheduleId,
          startTime: new Date(),
          endTime: new Date(),
          status: 'failed',
          totalAds: 0,
          updatedAds: 0,
          failedAds: 0,
          skippedAds: 0,
          processingTime: 0,
          errors: [error instanceof Error ? error.message : "Unknown error" as any],
          warnings: [],
          summary: {
            averageConfidence: 0,
            topUpdatedCampaigns: [],
          },
        };

        schedule.lastRun = failedRun.endTime;
        schedule.nextRun = this.calculateNextRun(schedule);
        schedule.runHistory.push(failedRun);

        await this.saveSchedule(schedule);

        if (schedule.enabled && schedule.nextRun) {
          this.scheduleJob(schedule);
        }
      }
    }
  }

  private calculateNextRun(config: ScheduleConfig): Date {
    const now = new Date();
    let nextRun = new Date(now);

    // Set the time
    const [hours, minutes] = config.time.split(':')?.filter(Boolean)?.map(Number);
    nextRun.setHours(hours, minutes, 0, 0);

    // If the time has passed today, move to next occurrence
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    // Apply frequency rules
    switch (config.frequency) {
      case 'hourly':
        nextRun = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      
      case 'daily':
        // Already handled above
        break;
      
      case 'weekly':
        if (config.daysOfWeek && config.daysOfWeek.length > 0) {
          // Find next valid day of week
          while (!config.daysOfWeek!.includes(nextRun.getDay()) || nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
        }
        break;
      
      case 'monthly':
        if (config.daysOfMonth && config.daysOfMonth.length > 0) {
          // Find next valid day of month
          while (!config.daysOfMonth!.includes(nextRun.getDate()) || nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
            
            // If we've gone to the next month, find the first valid day
            if (nextRun.getMonth() !== now.getMonth()) {
              nextRun.setDate(1);
              while (!config.daysOfMonth!.includes(nextRun.getDate())) {
                nextRun.setDate(nextRun.getDate() + 1);
              }
              break;
            }
          }
        }
        break;
    }

    // Check end date
    if (config.endDate && nextRun > config.endDate) {
      return new Date(0); // Far in the past to indicate no more runs
    }

    // Check start date
    if (config.startDate && nextRun < config.startDate) {
      nextRun = new Date(config.startDate);
      nextRun.setHours(hours, minutes, 0, 0);
    }

    return nextRun;
  }

  private async executeUpdate(options: ManualTriggerOptions): Promise<{
    success: boolean;
    totalAds: number;
    updatedAds: number;
    failedAds: number;
    skippedAds: number;
    errors: string[];
    warnings: string[];
    averageConfidence: number;
    campaignsUpdated: number;
    adGroupsUpdated: number;
    topUpdatedCampaigns: Array<{
      campaignId: string;
      campaignName: string;
      updateCount: number;
    }>;
  }> {
    // This would integrate with your existing update logic
    // Placeholder implementation
    
    logger.info('Executing update', { options });

    return {
      success: true,
      totalAds: 100,
      updatedAds: 85,
      failedAds: 5,
      skippedAds: 10,
      errors: [],
      warnings: ['Some ads were skipped due to low confidence'],
      averageConfidence: 0.85,
      campaignsUpdated: 12,
      adGroupsUpdated: 35,
      topUpdatedCampaigns: [
        { campaignId: 'camp1', campaignName: 'Search Campaign', updateCount: 25 },
        { campaignId: 'camp2', campaignName: 'Display Campaign', updateCount: 18 },
      ],
    };
  }

  private async sendSuccessNotification(schedule: ScheduleConfig, result: ScheduleRunResult): Promise<void> {
    try {
      const message = `Schedule "${schedule.name}" completed successfully. Updated ${result.updatedAds} ads.`;
      
      if (schedule.notifications.webhookUrl) {
        await this.sendWebhook(schedule.notifications.webhookUrl, {
          type: 'schedule_success',
          schedule,
          result,
        });
      }

      if (schedule.notifications.emailRecipients && schedule.notifications.emailRecipients.length > 0) {
        await this.sendEmail(schedule.notifications.emailRecipients, 'Schedule Success', message);
      }

      logger.info('Success notification sent', { scheduleId: schedule.id });
    } catch (error) {
      logger.error('Failed to send success notification', new EnhancedError('Failed to send success notification', { scheduleId: schedule.id, error: error instanceof Error ? error.message : String(error) }));
    }
  }

  private async sendFailureNotification(schedule: ScheduleConfig, result: ScheduleRunResult): Promise<void> {
    try {
      const message = `Schedule "${schedule.name}" failed. Errors: ${result.errors.join(', ')}`;
      
      if (schedule.notifications.webhookUrl) {
        await this.sendWebhook(schedule.notifications.webhookUrl, {
          type: 'schedule_failure',
          schedule,
          result,
        });
      }

      if (schedule.notifications.emailRecipients && schedule.notifications.emailRecipients.length > 0) {
        await this.sendEmail(schedule.notifications.emailRecipients, 'Schedule Failure', message);
      }

      logger.info('Failure notification sent', { scheduleId: schedule.id });
    } catch (error) {
      logger.error('Failed to send failure notification', new EnhancedError('Failed to send failure notification', { scheduleId: schedule.id, error: error instanceof Error ? error.message : String(error) }));
    }
  }

  private async sendWebhook(url: string, data: any): Promise<void> {
    // Placeholder for webhook implementation
    logger.info('Sending webhook', { url, data });
  }

  private async sendEmail(recipients: string[], subject: string, message: string): Promise<void> {
    // Placeholder for email implementation
    logger.info('Sending email', { recipients, subject, message });
  }

  private startCleanupTimer(): void {
    // Clean up old trigger results every hour
    setInterval(() => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Clean up manual triggers
      for (const [triggerId, trigger] of this.manualTriggers) {
        if (trigger.endTime && trigger.endTime < oneHourAgo) {
          this.manualTriggers.delete(triggerId);
        }
      }
    }, 60 * 60 * 1000);
  }

  private async saveSchedule(schedule: ScheduleConfig): Promise<void> {
    // Placeholder for persistent storage
    logger.info('Saving schedule', { scheduleId: schedule.id });
  }

  private async removeScheduleFromStorage(scheduleId: string): Promise<void> {
    // Placeholder for persistent storage removal
    logger.info('Removing schedule from storage', { scheduleId });
  }

  private loadSchedules(): void {
    // Placeholder for loading schedules from persistent storage
    logger.info('Loading schedules from storage');
  }
}