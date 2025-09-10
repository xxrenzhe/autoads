import { prisma } from '@/lib/prisma';
import { Cron } from 'croner';
import { AutoClickService } from './autoclick-service';
import { AutoClickExecutionEngine } from './autoclick-engine';
import { 
  getPSTDate, 
  getPSTHour, 
  utcToPST,
  isUSDaylightSavingTime,
  formatPSTTime,
  getExecutionWindowHours
} from '@/lib/utils/autoclick-timezone';

export class AutoClickScheduler {
  private static instance: AutoClickScheduler;
  private autoClickService: AutoClickService;
  private executionEngine: AutoClickExecutionEngine;
  private dailyPlanJob: Cron | null = null;
  private hourlyExecutionJob: Cron | null = null;
  private tokenSyncJob: Cron | null = null;

  private constructor() {
    this.autoClickService = new AutoClickService();
    this.executionEngine = new AutoClickExecutionEngine();
    this.initializeJobs();
  }

  static getInstance(): AutoClickScheduler {
    if (!AutoClickScheduler.instance) {
      AutoClickScheduler.instance = new AutoClickScheduler();
    }
    return AutoClickScheduler.instance;
  }

  private initializeJobs() {
    // 每日00:00 PST(UTC-8)生成执行计划 - UTC 08:00
    this.dailyPlanJob = new Cron('0 8 * * *', { timezone: 'UTC' }, async () => {
      console.log(`[AutoClick] Starting daily plan generation at ${formatPSTTime(new Date())}`);
      await this.generateDailyPlans();
    });

    // 每小时整点执行点击任务 (xx:00 PST/UTC-8)
    this.hourlyExecutionJob = new Cron('0 * * * *', { timezone: 'UTC' }, async () => {
      const now = new Date();
      const pstHour = getPSTHour(now);
      console.log(`[AutoClick] Starting hourly execution at ${formatPSTTime(now)} (PST hour: ${pstHour})`);
      await this.executeHourlyTasks();
    });

    // 每小时同步token消耗 (xx:05 PST/UTC-8)
    this.tokenSyncJob = new Cron('5 * * * *', { timezone: 'UTC' }, async () => {
      const now = new Date();
      const pstHour = getPSTHour(now);
      console.log(`[AutoClick] Starting token sync at ${formatPSTTime(now)} (PST hour: ${pstHour})`);
      await this.syncTokenUsage();
    });

    console.log('[AutoClick] Scheduler initialized with simplified UTC-8 timezone');
  }

  // 生成每日执行计划
  private async generateDailyPlans() {
    try {
      // 获取所有running状态的任务
      const runningTasks = await prisma.autoClickTask.findMany({
        where: { status: 'running' },
        include: {
          user: true
        }
      });

      console.log(`Found ${runningTasks.length} running tasks`);

      for (const task of runningTasks) {
        try {
          await this.generateTaskDailyPlan(task);
        } catch (error) {
          console.error(`Failed to generate daily plan for task ${task.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in daily plan generation:', error);
    }
  }

  // 为单个任务生成每日计划
  private async generateTaskDailyPlan(task: any) {
    // 使用PST日期
    const today = new Date();
    const pstToday = getPSTDate(today);
    const todayDate = new Date(pstToday + 'T00:00:00.000Z');

    // 检查是否已存在今日计划
    const existingPlan = await prisma.dailyExecutionPlan.findFirst({
      where: {
        taskId: task.id,
        executionDate: todayDate
      }
    });

    if (existingPlan) {
      console.log(`Daily plan already exists for task ${task.id}`);
      return;
    }

    // 生成小时点击分布
    const hourlyClicks = this.calculateHourlyDistribution(
      task.dailyClicks,
      task.timeWindow
    );

    // 创建执行计划
    const plan = await prisma.dailyExecutionPlan.create({
      data: {
        taskId: task.id,
        executionDate: today,
        hourlyClicks,
        currentVisitor: 'simple'
      }
    });

    // 创建小时执行记录
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyClicks[hour] > 0) {
        await prisma.hourlyExecution.create({
          data: {
            planId: plan.id,
            hour,
            targetClicks: hourlyClicks[hour],
            actualClicks: 0,
            successCount: 0,
            failCount: 0,
            tokensUsed: 0
          }
        });
      }
    }

    console.log(`Generated daily plan for task ${task.id} with ${task.dailyClicks} clicks`);
    
    // 缓存执行计划（简化版）
    await this.autoClickService.cacheExecutionPlan(task.id, {
      taskId: task.id,
      executionDate: todayDate,
      hourlyClicks,
      currentVisitor: 'simple'
    });
  }

  // 计算小时点击分布
  private calculateHourlyDistribution(dailyClicks: number, timeWindow: string): number[] {
    // 确定活跃小时
    const activeHours = getExecutionWindowHours(timeWindow);

    // 时间权重配置
    const timeWeights: Record<number, number> = {
      // 高峰时段
      9: 1.2, 10: 1.2, 11: 1.2,
      14: 1.2, 15: 1.2, 16: 1.2,
      19: 1.2, 20: 1.2, 21: 1.2,
      // 低谷时段
      0: 0.8, 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8,
      // 其他时段
      6: 1.0, 7: 1.0, 8: 1.0,
      12: 1.0, 13: 1.0,
      17: 1.0, 18: 1.0,
      22: 1.0, 23: 1.0
    };

    // 计算基础平均值
    const baseAvg = dailyClicks / activeHours.length;

    // 计算加权目标值
    const weightedTargets: number[] = new Array(24).fill(0);
    let totalWeighted = 0;

    for (const hour of activeHours) {
      const weight = timeWeights[hour] || 1.0;
      weightedTargets[hour] = baseAvg * weight;
      totalWeighted += weightedTargets[hour];
    }

    // 调整到精确的目标总数
    const adjustmentFactor = dailyClicks / totalWeighted;
    for (const hour of activeHours) {
      weightedTargets[hour] = Math.round(weightedTargets[hour] * adjustmentFactor);
    }

    // 应用随机波动
    const variance = parseFloat(process.env.AutoClick_Count_Variance_Hour || '0.3'); // 从环境变量读取，默认0.3（30%波动）
    const finalTargets: number[] = new Array(24).fill(0);
    let totalAfterVariance = 0;

    for (const hour of activeHours) {
      const target = weightedTargets[hour];
      const min = Math.floor(target * (1 - variance));
      const max = Math.ceil(target * (1 + variance));
      finalTargets[hour] = Math.floor(Math.random() * (max - min + 1)) + min;
      totalAfterVariance += finalTargets[hour];
    }

    // 调整总和确保精确匹配
    const difference = dailyClicks - totalAfterVariance;
    if (difference !== 0) {
      const activeHoursCopy = [...activeHours];
      // 随机调整某些小时
      while (difference !== 0 && activeHoursCopy.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeHoursCopy.length);
        const hour = activeHoursCopy[randomIndex];
        
        if (difference > 0) {
          finalTargets[hour]++;
          totalAfterVariance++;
        } else {
          if (finalTargets[hour] > 1) {
            finalTargets[hour]--;
            totalAfterVariance--;
          }
        }
        
        if (totalAfterVariance === dailyClicks) break;
        activeHoursCopy.splice(randomIndex, 1);
      }
    }

    return finalTargets;
  }

  // 执行小时任务
  private async executeHourlyTasks() {
    try {
      const currentHour = getPSTHour();
      const today = new Date();
      const pstToday = getPSTDate(today);
      const todayDate = new Date(pstToday + 'T00:00:00.000Z');

      // 获取当前小时需要执行的计划
      const plans = await prisma.dailyExecutionPlan.findMany({
        where: {
          executionDate: todayDate
        },
        include: {
          task: {
            include: {
              user: true
            }
          },
          hourlyExecutions: {
            where: {
              hour: currentHour
            }
          }
        }
      });

      console.log(`Found ${plans.length} plans for hour ${currentHour}`);

      for (const plan of plans) {
        const hourlyExecution = plan.hourlyExecutions[0];
        if (!hourlyExecution || hourlyExecution.targetClicks === 0) {
          continue;
        }

        try {
          await this.executeHourlyClicks(plan, hourlyExecution);
        } catch (error) {
          console.error(`Failed to execute hourly task for plan ${plan.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in hourly execution:', error);
    }
  }

  // 执行小时点击
  private async executeHourlyClicks(plan: any, hourlyExecution: any) {
    console.log(`Executing ${hourlyExecution.targetClicks} clicks for plan ${plan.id}`);
    
    // 执行前检查用户 token 余额
    const user = await prisma.user.findUnique({
      where: { id: plan.task.userId }
    });
    
    if (!user) {
      console.error(`User not found for task ${plan.task.id}`);
      return;
    }
    
    // 检查 token 余额是否足够本次执行
    if ((user.tokenBalance || 0) < hourlyExecution.targetClicks) {
      console.log(`Insufficient tokens for user ${user.id}. Required: ${hourlyExecution.targetClicks}, Available: ${user.tokenBalance || 0}`);
      
      // 终止任务并记录日志
      await prisma.autoClickTask.update({
        where: { id: plan.task.id },
        data: { status: 'terminated' }
      });
      
      // 记录终止日志
      await prisma.userActivity.create({
        data: {
          userId: user.id,
          action: 'autoclick_task_terminated_insufficient_tokens',
          resource: 'autoclick',
          metadata: {
            taskId: plan.task.id,
            requiredTokens: hourlyExecution.targetClicks,
            tokenBalance: user.tokenBalance || 0,
            hour: hourlyExecution.hour,
            reason: 'Insufficient tokens for hourly execution'
          }
        }
      });
      
      return;
    }
    
    const result = await this.executionEngine.executeHourlyTask(plan.id, hourlyExecution.hour);
    console.log(`Execution result for plan ${plan.id}:`, result);
  }

  // 同步Token消耗
  private async syncTokenUsage() {
    try {
      const now = new Date();
      const previousHour = getPSTHour(now) - 1;
      if (previousHour < 0) {
        // 如果是前一天的23点
        console.log('[AutoClick] Skipping token sync - previous hour was from yesterday');
        return;
      }
      
      const pstToday = getPSTDate(now);
      const todayDate = new Date(pstToday + 'T00:00:00.000Z');

      // 获取上个小时的所有执行记录
      const executions = await prisma.hourlyExecution.findMany({
        where: {
          hour: previousHour,
          plan: {
            executionDate: todayDate
          }
        },
        include: {
          plan: {
            include: {
              task: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

      // 按用户汇总token消耗和统计
      const userStats: Record<string, {
        totalTokens: number;
        totalClicks: number;
        successCount: number;
        failCount: number;
        taskIds: string[];
      }> = {};
      
      for (const execution of executions) {
        const userId = execution.plan.task.userId;
        const taskId = execution.plan.taskId;
        
        if (!userStats[userId]) {
          userStats[userId] = {
            totalTokens: 0,
            totalClicks: 0,
            successCount: 0,
            failCount: 0,
            taskIds: []
          };
        }
        
        userStats[userId].totalTokens += execution.tokensUsed;
        userStats[userId].totalClicks += execution.actualClicks;
        userStats[userId].successCount += execution.successCount;
        userStats[userId].failCount += execution.failCount;
        
        if (!userStats[userId].taskIds.includes(taskId)) {
          userStats[userId].taskIds.push(taskId);
        }
      }

      // 记录汇总统计
      const currentHour = new Date().getHours();
      console.log(`=== AutoClick Token Sync Summary (${previousHour}:00-${currentHour}:00) ===`);
      
      for (const [userId, stats] of Object.entries(userStats)) {
        console.log(`User ${userId}:`);
        console.log(`  - Total tokens consumed: ${stats.totalTokens}`);
        console.log(`  - Total clicks: ${stats.totalClicks}`);
        console.log(`  - Success rate: ${stats.totalClicks > 0 ? Math.round((stats.successCount / stats.totalClicks) * 100) : 0}%`);
        console.log(`  - Active tasks: ${stats.taskIds.length}`);
        
        // 记录到用户活动日志
        try {
          await prisma.userActivity.create({
            data: {
              userId,
              action: 'autoclick_hourly_summary',
              resource: 'autoclick',
              metadata: {
                hour: previousHour,
                totalTokens: stats.totalTokens,
                totalClicks: stats.totalClicks,
                successCount: stats.successCount,
                failCount: stats.failCount,
                taskIds: stats.taskIds,
                timestamp: new Date().toISOString()
              }
            }
          });
        } catch (logError) {
          console.error('Failed to log user activity:', logError);
        }
      }
      
      // 检查异常消耗（防作弊机制）
      for (const [userId, stats] of Object.entries(userStats)) {
        // 如果某个用户消耗异常高，记录警告
        const avgTokensPerClick = stats.totalClicks > 0 ? stats.totalTokens / stats.totalClicks : 0;
        if (avgTokensPerClick > 3) { // 正常应该是1-2个token
          console.warn(`Warning: User ${userId} has high token consumption rate: ${avgTokensPerClick} tokens/click`);
          
          // 记录异常活动
          await prisma.userActivity.create({
            data: {
              userId,
              action: 'autoclick_abnormal_consumption',
              resource: 'autoclick',
              metadata: {
                hour: previousHour,
                avgTokensPerClick,
                totalTokens: stats.totalTokens,
                totalClicks: stats.totalClicks,
                timestamp: new Date().toISOString()
              }
            }
          });
        }
      }
      
    } catch (error) {
      console.error('Error in token sync:', error);
    }
  }

  // 启动调度器
  public start() {
    console.log('Starting AutoClick scheduler...');
    // Cron jobs are already started in constructor
  }

  // 停止调度器
  public stop() {
    console.log('Stopping AutoClick scheduler...');
    if (this.dailyPlanJob) this.dailyPlanJob.stop();
    if (this.hourlyExecutionJob) this.hourlyExecutionJob.stop();
    if (this.tokenSyncJob) this.tokenSyncJob.stop();
  }

  // 手动触发每日计划生成（用于测试）
  public async triggerDailyPlanGeneration() {
    await this.generateDailyPlans();
  }

  // 手动触发小时执行（用于测试）
  public async triggerHourlyExecution() {
    await this.executeHourlyTasks();
  }

  // 手动触发token同步（用于测试）
  public async triggerTokenSync() {
    await this.syncTokenUsage();
  }
}