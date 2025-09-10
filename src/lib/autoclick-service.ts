import { prisma } from '@/lib/prisma';
import { createClient } from 'redis';
import { 
  CreateAutoClickTaskInput, 
  UpdateAutoClickTaskInput, 
  AutoClickTaskFilters,
  AutoClickTasksResponse,
  AutoClickTaskWithDetails,
  TaskProgress,
  DailyExecutionStats,
  HourlyExecutionDetail
} from '@/types/autoclick';

// 简化的Redis客户端
class SimpleCache {
  private client: any;
  private isConnected: boolean = false;
  
  constructor() {
    this.initializeClient();
  }
  
  private async initializeClient() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      this.client.on('error', () => {
        this.isConnected = false;
      });
      
      this.client.on('connect', () => {
        this.isConnected = true;
      });
      
      await this.client.connect();
    } catch {
      this.isConnected = false;
    }
  }
  
  isReady() {
    return this.isConnected;
  }
  
  async set(key: string, value: any, ttl: number = 3600) {
    if (!this.isReady()) return;
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch {
      // Ignore cache errors
    }
  }
  
  async get(key: string) {
    if (!this.isReady()) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }
}

export class AutoClickService {
  private cache: SimpleCache;
  
  constructor() {
    this.cache = new SimpleCache();
  }
  // 创建任务
  async createTask(userId: string, input: CreateAutoClickTaskInput) {
    // 验证输入
    if (!input.offerUrl || !input.timeWindow || !input.dailyClicks || !input.referer) {
      throw new Error('Missing required fields');
    }

    if (input.dailyClicks < 1 || input.dailyClicks > 10000) {
      throw new Error('Daily clicks must be between 1 and 10000');
    }

    // 验证时间窗口
    const validTimeWindows = ['00:00-24:00', '06:00-24:00'];
    if (!validTimeWindows.includes(input.timeWindow)) {
      throw new Error('Invalid time window');
    }

    const task = await prisma.autoClickTask.create({
      data: {
        userId,
        offerUrl: input.offerUrl,
        country: input.country || 'US',
        timeWindow: input.timeWindow,
        dailyClicks: input.dailyClicks,
        referer: input.referer,
        status: 'pending'
      }
    });

    // 任务创建完成（无需发送消息）

    return task;
  }

  // 获取任务列表
  async getTasks(filters: AutoClickTaskFilters = {}): Promise<AutoClickTasksResponse> {
    const { status, country, userId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (country) where.country = country;
    if (userId) where.userId = userId;

    const [tasks, total] = await Promise.all([
      prisma.autoClickTask.findMany({
        where,
        include: {
          _count: {
            select: {
              dailyPlans: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.autoClickTask.count({ where })
    ]);

    return {
      tasks: tasks as AutoClickTaskWithDetails[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // 获取单个任务
  async getTaskById(taskId: string, userId?: string) {
    const where: any = { id: taskId };
    if (userId) where.userId = userId;

    const task = await prisma.autoClickTask.findFirst({
      where,
      include: {
        dailyPlans: {
          include: {
            hourlyExecutions: true,
            dailySummary: true
          },
          orderBy: {
            executionDate: 'desc'
          },
          take: 7 // 最近7天
        }
      }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  }

  // 更新任务
  async updateTask(taskId: string, userId: string | undefined, input: UpdateAutoClickTaskInput) {
    const where: any = { id: taskId };
    if (userId) where.userId = userId;

    const task = await prisma.autoClickTask.findFirst({
      where
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const updatedTask = await prisma.autoClickTask.update({
      where: { id: taskId },
      data: input
    });

    return updatedTask;
  }

  // 删除任务
  async deleteTask(taskId: string, userId: string | undefined) {
    const where: any = { id: taskId };
    if (userId) where.userId = userId;

    const task = await prisma.autoClickTask.findFirst({
      where
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // 删除相关的执行记录
    await prisma.autoClickTask.delete({
      where: { id: taskId }
    });

    return true;
  }

  // 启动任务
  async startTask(taskId: string, userId: string) {
    const task = await prisma.autoClickTask.findFirst({
      where: { id: taskId, userId },
      include: {
        user: true
      }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status === 'running') {
      throw new Error('Task is already running');
    }

    // 检查 token 余额是否足够执行一次完整任务
    if ((task.user.tokenBalance || 0) < task.dailyClicks) {
      // 余额不足，终止任务并记录日志
      await prisma.autoClickTask.update({
        where: { id: taskId },
        data: { status: 'terminated' }
      });

      // 记录终止日志
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'autoclick_task_terminated_insufficient_tokens',
          resource: 'autoclick',
          metadata: {
            taskId,
            dailyClicks: task.dailyClicks,
            tokenBalance: task.user.tokenBalance || 0,
            reason: 'Insufficient tokens for task activation'
          }
        }
      });

      throw new Error('Insufficient token balance to activate task');
    }

    const updatedTask = await prisma.autoClickTask.update({
      where: { id: taskId },
      data: { status: 'running' }
    });

    return updatedTask;
  }

  // 停止任务
  async stopTask(taskId: string, userId: string) {
    const task = await prisma.autoClickTask.findFirst({
      where: { id: taskId, userId }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const updatedTask = await prisma.autoClickTask.update({
      where: { id: taskId },
      data: { status: 'pending' }
    });

    return updatedTask;
  }

  // 终止任务
  async terminateTask(taskId: string, userId: string) {
    const task = await prisma.autoClickTask.findFirst({
      where: { id: taskId, userId }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const updatedTask = await prisma.autoClickTask.update({
      where: { id: taskId },
      data: { status: 'terminated' }
    });

    return updatedTask;
  }

  // 获取任务进度
  async getTaskProgress(taskId: string, userId?: string): Promise<TaskProgress> {
    const where: any = { id: taskId };
    if (userId) where.userId = userId;

    const task = await prisma.autoClickTask.findFirst({
      where
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // 获取今天的执行计划
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayPlan = await prisma.dailyExecutionPlan.findFirst({
      where: {
        taskId,
        executionDate: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        hourlyExecutions: {
          orderBy: {
            hour: 'asc'
          }
        }
      }
    });

    const currentHour = new Date().getHours();
    let totalTarget = 0;
    let completed = 0;
    const hourlyProgress: HourlyExecutionDetail[] = [];

    if (todayPlan) {
      // 计算今日总目标
      totalTarget = todayPlan.hourlyClicks.reduce((sum: number, clicks: number) => sum + clicks, 0);
      
      // 计算已完成数量
      for (let i = 0; i <= currentHour; i++) {
        const execution = todayPlan.hourlyExecutions.find((e: any) => e.hour === i);
        const target = todayPlan.hourlyClicks[i] || 0;
        
        hourlyProgress.push({
          hour: i,
          targetClicks: target,
          actualClicks: execution?.actualClicks || 0,
          successCount: execution?.successCount || 0,
          failCount: execution?.failCount || 0,
          tokensUsed: execution?.tokensUsed || 0,
          executionDetails: execution?.executionDetails
        });
        
        completed += execution?.successCount || 0;
      }
    }

    return {
      taskId,
      todayProgress: {
        totalTarget,
        completed,
        percentage: totalTarget > 0 ? Math.round((completed / totalTarget) * 100) : 0
      },
      currentHour,
      hourlyProgress,
      status: task.status as any,
      lastExecution: task.updatedAt
    };
  }

  // 获取执行记录
  async getExecutionRecords(taskId: string, userId?: string, days: number = 7) {
    const where: any = { taskId };
    if (userId) {
      const task = await prisma.autoClickTask.findFirst({
        where: { id: taskId, userId }
      });
      if (!task) {
        throw new Error('Task not found');
      }
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await prisma.dailyExecutionPlan.findMany({
      where: {
        ...where,
        executionDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        dailySummary: true,
        hourlyExecutions: {
          orderBy: {
            hour: 'asc'
          }
        }
      },
      orderBy: {
        executionDate: 'desc'
      }
    });

    return records;
  }

  // 获取系统统计
  async getSystemStats() {
    const [totalTasks, runningTasks, pendingTasks, terminatedTasks] = await Promise.all([
      prisma.autoClickTask.count(),
      prisma.autoClickTask.count({ where: { status: 'running' } }),
      prisma.autoClickTask.count({ where: { status: 'pending' } }),
      prisma.autoClickTask.count({ where: { status: 'terminated' } })
    ]);

    // 获取今日统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await prisma.dailySummary.aggregate({
      where: {
        executionDate: {
          gte: today,
          lt: tomorrow
        }
      },
      _sum: {
        totalClicks: true,
        totalSuccess: true,
        totalFail: true,
        totalTokens: true
      }
    });

    return {
      tasks: {
        total: totalTasks,
        running: runningTasks,
        pending: pendingTasks,
        terminated: terminatedTasks
      },
      today: {
        totalClicks: todayStats._sum.totalClicks || 0,
        successCount: todayStats._sum.totalSuccess || 0,
        failCount: todayStats._sum.totalFail || 0,
        tokensUsed: todayStats._sum.totalTokens || 0
      }
    };
  }

  // 简化的缓存方法 - 统一TTL为1小时
  async cacheData(key: string, value: any) {
    await this.cache.set(`autoclick:${key}`, value, 3600);
  }

  async getCachedData(key: string) {
    return this.cache.get(`autoclick:${key}`);
  }

  // 保持兼容性的方法
  async cacheProxyPool(proxies: any[], userId: string) {
    await this.cacheData(`proxy_pool:${userId}`, proxies);
  }

  async getCachedProxyPool(userId: string) {
    return this.getCachedData(`proxy_pool:${userId}`);
  }

  async cacheExecutionPlan(taskId: string, plan: any) {
    await this.cacheData(`execution_plan:${taskId}`, plan);
  }

  async getCachedExecutionPlan(taskId: string) {
    return this.getCachedData(`execution_plan:${taskId}`);
  }

  // 移除Kafka消息功能 - 直接记录到日志
  async logTaskAction(taskId: string, userId: string, action: string, data: any) {
    console.log(`[AutoClick] Task ${taskId}: ${action} by user ${userId}`, data);
  }

  // 简化的任务恢复
  async recoverTasks() {
    const runningTasks = await prisma.autoClickTask.findMany({
      where: { status: 'running' }
    });

    for (const task of runningTasks) {
      // 检查是否有今日的执行计划
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayPlan = await prisma.dailyExecutionPlan.findFirst({
        where: {
          taskId: task.id,
          executionDate: {
            gte: today,
            lt: tomorrow
          }
        }
      });

      if (!todayPlan) {
        // 重新生成今日计划
        await this.generateDailyPlan(task);
      }
    }
  }

  // 简化的每日计划生成
  private async generateDailyPlan(task: any) {
    // 计算小时分布
    const activeHours = task.timeWindow === '06:00-24:00' 
      ? Array.from({ length: 18 }, (_, i) => i + 6)
      : Array.from({ length: 24 }, (_, i) => i);

    const baseAvg = task.dailyClicks / activeHours.length;
    const hourlyClicks = new Array(24).fill(0);

    // 简化的平均分配
    activeHours.forEach(hour => {
      hourlyClicks[hour] = Math.round(baseAvg);
    });

    // 创建执行计划
    await prisma.dailyExecutionPlan.create({
      data: {
        taskId: task.id,
        executionDate: new Date(),
        hourlyClicks,
        currentVisitor: 'simple'
      }
    });
  }
}