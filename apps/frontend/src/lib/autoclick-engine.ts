import { prisma } from '@/lib/prisma';
import { SimpleHttpVisitor } from '@/lib/simple-http-visitor';
import { PuppeteerVisitor } from '@/lib/puppeteer-visitor';
import { TokenService } from '@/lib/services/token-service';
import { tokenusagefeature } from '@prisma/client';
import { AutoClickService } from '@/lib/autoclick-service';

export interface ExecutionResult {
  success: boolean;
  tokensUsed: number;
  duration: number;
  error?: string;
  details?: any;
}

export class AutoClickExecutionEngine {
  private simpleHttpVisitor: SimpleHttpVisitor;
  private puppeteerVisitor: PuppeteerVisitor;
  private autoClickService: AutoClickService;

  constructor() {
    this.simpleHttpVisitor = new SimpleHttpVisitor();
    this.puppeteerVisitor = new PuppeteerVisitor();
    this.autoClickService = new AutoClickService();
  }

  // 执行单个点击
  async executeClick(params: {
    url: string;
    referer: string;
    proxyUrl?: string;
    visitorType: 'simple' | 'puppeteer';
    userId: string;
  }): Promise<ExecutionResult> {
    const startTime = Date.now();
    let success = false;
    let tokensUsed = 0;
    let error: string | undefined;
    let details: any;

    try {
      // 验证用户token余额
      const tokenCheck = await TokenService.checkTokenBalance(
        params.userId, 
        params.visitorType === 'simple' ? 1 : 2
      );
      
      if (!tokenCheck.sufficient) {
        throw new Error('Insufficient token balance');
      }

      // 获取代理IP（使用缓存）
      let proxyConfig = params.proxyUrl ? await this.parseProxyUrl(params.proxyUrl) : undefined;
      
      // 缓存代理验证结果（简化版，直接忽略）
      // if (params.proxyUrl && proxyIP) {
      //   // 简化的缓存逻辑已移至AutoClickService
      // }
      
      // 执行访问
      let visitorResult;
      if (params.visitorType === 'simple') {
        visitorResult = await this.simpleHttpVisitor.visitUrl({
          url: params.url,
          referer: params.referer,
          proxy: proxyConfig,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          timeout: 30000
        });
      } else {
        visitorResult = await this.puppeteerVisitor.visit({
          url: params.url,
          referer: params.referer,
          proxy: proxyConfig,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          timeout: 30000
        });
      }

      success = visitorResult.success;
      details = visitorResult;

      // 记录执行日志
      await this.autoClickService.logTaskAction('temp', params.userId, 'click_executed', {
        url: params.url,
        visitorType: params.visitorType,
        success,
        duration: Date.now() - startTime,
        proxyUsed: !!params.proxyUrl
      });

      // 消耗token（仅成功时）
      if (success) {
        const tokenResult = await TokenService.consumeTokens(
          params.userId,
          'autoclick',
          'click_execution',
          {
            metadata: {
              url: params.url,
              visitorType: params.visitorType
            }
          }
        );
        
        if (tokenResult.success) {
          tokensUsed = tokenResult.tokensConsumed || 0;
        }
      }

      return {
        success,
        tokensUsed,
        duration: Date.now() - startTime,
        details
      };
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
      
      return {
        success,
        tokensUsed,
        duration: Date.now() - startTime,
        error
      };
    }
  }

  // 执行小时任务
  async executeHourlyTask(planId: string, hour: number): Promise<{
    totalClicks: number;
    successCount: number;
    failCount: number;
    tokensUsed: number;
    executionDetails: any[];
  }> {
    // 获取执行计划
    const plan = await prisma.dailyExecutionPlan.findUnique({
      where: { id: planId },
      include: {
        task: {
          include: {
            user: true
          }
        },
        hourlyExecutions: {
          where: { hour }
        }
      }
    });

    if (!plan || !plan.hourlyExecutions[0]) {
      throw new Error('Execution plan not found');
    }

    const execution = plan.hourlyExecutions[0];
    const targetClicks = execution.targetClicks;
    
    // 检查是否已经完成
    if (execution.actualClicks >= targetClicks) {
      return {
        totalClicks: execution.actualClicks,
        successCount: execution.successCount,
        failCount: execution.failCount,
        tokensUsed: execution.tokensUsed,
        executionDetails: execution.executionDetails || []
      };
    }

    // 计算剩余需要执行的点击数
    const remainingClicks = targetClicks - execution.actualClicks;
    const results: ExecutionResult[] = [];
    
    // 生成执行时间点（正态分布）
    const executionTimes = this.generateExecutionTimes(hour, remainingClicks);
    
    // 获取代理URL
    const proxyUrl = process.env.Proxy_URL_US;

    // 执行点击
    for (let i = 0; i < remainingClicks; i++) {
      try {
        // 等待到执行时间
        const now = Date.now();
        const targetTime = executionTimes[i];
        if (targetTime > now) {
          await this.sleep(targetTime - now);
        }

        // 执行点击
        const result = await this.executeClick({
          url: plan.task.offerUrl,
          referer: plan.task.referer,
          proxyUrl,
          visitorType: plan.currentVisitor as 'simple' | 'puppeteer',
          userId: plan.task.userId
        });

        // 更新taskId
        const kafkaMessage = {
          taskId: plan.taskId,
          userId: plan.task.userId,
          action: 'click_executed',
          timestamp: new Date().toISOString(),
          metadata: {
            url: plan.task.offerUrl,
            visitorType: plan.currentVisitor,
            success: result.success,
            duration: result.duration,
            tokensUsed: result.tokensUsed,
            proxyUsed: !!proxyUrl,
            executionPhase: 'hourly_task',
            hour: hour,
            clickIndex: i + 1,
            totalClicks: remainingClicks
          }
        };
        
        // 记录执行日志
        await this.autoClickService.logTaskAction(plan.taskId, plan.task.userId, 'click_executed', {
          ...kafkaMessage.metadata,
          executionPhase: 'hourly_task',
          hour: hour,
          clickIndex: i + 1,
          totalClicks: remainingClicks
        });
        
        // 每10次点击记录一次进度
        if ((i + 1) % 10 === 0 || i === remainingClicks - 1) {
          await this.autoClickService.logTaskAction(plan.taskId, plan.task.userId, 'progress_update', {
            ...kafkaMessage.metadata,
            progress: ((i + 1) / remainingClicks) * 100
          });
        }

        results.push(result);

        // 更新执行记录
        await this.updateExecutionRecord(execution.id, result);

        // 如果是最后一次点击，更新日汇总
        if (i === remainingClicks - 1) {
          await this.updateDailySummary(plan.taskId, plan.executionDate);
        }

      } catch (error) {
        console.error(`Error executing click ${i + 1}/${remainingClicks}:`, error);
        
        const errorResult = {
          success: false,
          tokensUsed: 0,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        results.push(errorResult);
        
        // 记录错误日志
        await this.autoClickService.logTaskAction(plan.taskId, plan.task.userId, 'click_error', {
          error: errorResult.error,
          clickIndex: i + 1,
          totalClicks: remainingClicks,
          hour: hour
        });
      }
    }

    // 检查是否需要切换访问器
    const successRate = results.filter((r: any) => r.success).length / results.length;
    if (successRate === 0 && plan.currentVisitor === 'simple') {
      // 切换到Puppeteer
      await prisma.dailyExecutionPlan.update({
        where: { id: planId },
        data: { currentVisitor: 'puppeteer' }
      });
      
      // 记录状态变更日志
      await this.autoClickService.logTaskAction(plan.taskId, plan.task.userId, 'visitor_switched', {
        fromVisitor: 'simple',
        toVisitor: 'puppeteer',
        reason: 'zero_success_rate'
      });
    } else if (successRate === 0 && plan.currentVisitor === 'puppeteer') {
      // 连续失败，终止任务
      await prisma.autoClickTask.update({
        where: { id: plan.taskId },
        data: { status: 'terminated' }
      });
      
      // 记录状态变更日志
      await this.autoClickService.logTaskAction(plan.taskId, plan.task.userId, 'task_terminated', {
        reason: 'continuous_failure',
        successRate: 0,
        totalAttempts: results.length
      });
    }

    return {
      totalClicks: execution.actualClicks + remainingClicks,
      successCount: execution.successCount + results.filter((r: any) => r.success).length,
      failCount: execution.failCount + results.filter((r: any) => !r.success).length,
      tokensUsed: execution.tokensUsed + results.reduce((sum, r: any) => sum + r.tokensUsed, 0),
      executionDetails: [...(execution.executionDetails || []), ...results]
    };
  }

  // 生成执行时间点（正态分布）
  private generateExecutionTimes(hour: number, count: number): number[] {
    const times: number[] = [];
    const start = new Date();
    start.setHours(hour, 5, 0, 0); // 小时开始后5分钟
    const end = new Date(start);
    end.setHours(hour + 1, -5, 0, 0); // 小时结束前5分钟

    // 使用正态分布生成时间点
    const mean = (start.getTime() + end.getTime()) / 2;
    const stdDev = (end.getTime() - start.getTime()) / 6;

    for (let i = 0; i < count; i++) {
      let time;
      do {
        time = this.normalRandom(mean, stdDev);
      } while (time < start.getTime() || time > end.getTime());
      times.push(time);
    }

    return times.sort((a, b) => a - b);
  }

  // 正态分布随机数生成
  private normalRandom(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  // 获取代理IP
  private async fetchProxyIP(proxyUrl: string): Promise<string> {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch proxy IP');
      }
      return await response.text();
    } catch (error) {
      console.error('Error fetching proxy IP:', error);
      throw error;
    }
  }

  private async parseProxyUrl(proxyUrl: string): Promise<any> {
    try {
      const proxyIP = await this.fetchProxyIP(proxyUrl);
      // Simple parsing - assuming format like "http://ip:port" or just "ip:port"
      if (proxyIP.includes('://')) {
        const url = new URL(proxyIP);
        return {
          protocol: url.protocol.replace(':', ''),
          host: url.hostname,
          port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80)
        };
      } else if (proxyIP.includes(':')) {
        const [host, portStr] = proxyIP.split(':');
        return {
          protocol: 'http',
          host,
          port: parseInt(portStr) || 80
        };
      } else {
        // Just IP address
        return {
          protocol: 'http',
          host: proxyIP,
          port: 80
        };
      }
    } catch (error) {
      console.error('Error parsing proxy URL:', error);
      throw error;
    }
  }

  // 更新执行记录
  private async updateExecutionRecord(executionId: string, result: ExecutionResult) {
    await prisma.hourlyExecution.update({
      where: { id: executionId },
      data: {
        actualClicks: {
          increment: 1
        },
        successCount: {
          increment: result.success ? 1 : 0
        },
        failCount: {
          increment: result.success ? 0 : 1
        },
        tokensUsed: {
          increment: result.tokensUsed
        },
        executionDetails: {
          push: {
            timestamp: new Date().toISOString(),
            ...result
          }
        }
      }
    });
  }

  // 更新日汇总
  private async updateDailySummary(taskId: string, executionDate: Date) {
    // 获取今日所有小时执行记录
    const hourlyExecutions = await prisma.hourlyExecution.findMany({
      where: {
        plan: {
          taskId,
          executionDate
        }
      }
    });

    const totalClicks = hourlyExecutions.reduce((sum: number, h: any) => sum + h.actualClicks, 0);
    const totalSuccess = hourlyExecutions.reduce((sum: number, h: any) => sum + h.successCount, 0);
    const totalFail = hourlyExecutions.reduce((sum: number, h: any) => sum + h.failCount, 0);
    const totalTokens = hourlyExecutions.reduce((sum: number, h: any) => sum + h.tokensUsed, 0);

    // 确定执行状态
    const executionStatus = totalSuccess >= totalClicks ? 'success' : 
                           totalSuccess > 0 ? 'partial' : 'failed';

    // 更新或创建日汇总
    await prisma.dailySummary.upsert({
      where: {
        taskId_executionDate: {
          taskId,
          executionDate
        }
      },
      update: {
        totalClicks,
        totalSuccess,
        totalFail,
        totalTokens,
        executionStatus
      },
      create: {
        taskId,
        userId: (await prisma.autoClickTask.findUnique({ where: { id: taskId } }))!.userId,
        executionDate,
        totalClicks,
        totalSuccess,
        totalFail,
        totalTokens,
        executionStatus
      }
    });
  }

  // 睡眠函数
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取任务执行状态
  async getTaskExecutionStatus(taskId: string): Promise<{
    isRunning: boolean;
    currentHour: number;
    todayProgress: {
      target: number;
      completed: number;
      percentage: number;
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentHour = new Date().getHours();

    const plan = await prisma.dailyExecutionPlan.findFirst({
      where: {
        taskId,
        executionDate: today
      },
      include: {
        hourlyExecutions: {
          where: {
            hour: {
              lte: currentHour
            }
          }
        }
      }
    });

    if (!plan) {
      return {
        isRunning: false,
        currentHour,
        todayProgress: { target: 0, completed: 0, percentage: 0 }
      };
    }

    const target = plan.hourlyClicks.slice(0, currentHour + 1).reduce((sum: number, clicks: number) => sum + clicks, 0);
    const completed = plan.hourlyExecutions.reduce((sum: number, h: any) => sum + h.successCount, 0);

    return {
      isRunning: true,
      currentHour,
      todayProgress: {
        target,
        completed,
        percentage: target > 0 ? Math.round((completed / target) * 100) : 0
      }
    };
  }
}
