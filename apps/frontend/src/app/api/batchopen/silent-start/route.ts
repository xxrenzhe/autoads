import { NextRequest, NextResponse } from 'next/server';
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';
import { executeBatchTask, TaskExecutionOptions } from '@/lib/services/task-execution-service';
import { proxyService } from '@/lib/services/proxy-service';
import { resultService } from '@/lib/services/result-service';
import { BATCH_OPEN_CONFIG, getConcurrencyLimit } from '@/config/batch-open';
import { preCalculateTotalVisits } from '@/lib/utils/visit-calculator';
import { withBatchOpenTokenTracking, batchOpenTokenTrackingConfig } from '@/lib/middleware/batchopen-token-middleware';
import { requireFeature } from '@/lib/utils/subscription-based-api';
import { withApiErrorHandling } from '@/lib/utils/api-error-middleware';
import { withFeatureMonitoring } from '@/lib/feature-monitor';
import { withConcurrentLimit } from '@/lib/concurrent-limit';
import { taskQueue } from '@/lib/task-queue';

import { log, createCategoryLogger } from '@/lib/utils/centralized-logging';
import { 
  BaseAppError, 
  ValidationError, 
  BusinessRuleError, 
  TaskError 
} from '@/lib/utils/unified-error-handling';
import { z } from 'zod';

const logger = createCategoryLogger('SilentBatchOpenAPI');

// 设置全局静默模式标志
(globalThis as any).isSilentMode = true;

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5分钟最大执行时间

// Define validation schema using Zod
const SilentBatchRequestSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  urls: z.array(z.string().url('Invalid URL format'))
    .min(1, 'At least one URL is required')
    .max(1000, 'Maximum 1000 URLs allowed'),
  cycleCount: z.number().int().min(1, 'Cycle count must be at least 1').max(100, 'Maximum 100 cycles allowed'),
  openInterval: z.number().int().min(0).optional(),
  proxyUrl: z.string().url('Invalid proxy URL').optional(),
  refererOption: z.enum(['social', 'custom']).optional(),
  selectedSocialMedia: z.string().optional(),
  customReferer: z.string().optional(),
  proxyValidated: z.boolean().optional(),
  urlVisits: z.array(z.number().int().positive()).optional(),
  actualTotalVisits: z.number().int().positive().optional(),
  useSingleProxyStrategy: z.boolean().default(false),
  enableConcurrentExecution: z.boolean().default(false),
  maxConcurrency: z.number().int().min(1).max(10).default(3),
  proxyReuseInterval: z.number().int().min(100).optional(),
  enableRandomization: z.boolean().default(false),
  randomVariation: z.number().min(0).max(100).optional(),
  accessMode: z.enum(['http', 'puppeteer']).default('http')
});

// 原始的POST处理器（不包含Token消耗逻辑）
async function handlePOST(request: NextRequest, context: any) {
  const { validatedBody, user, features, limits } = context;
  try {
    const startTime = Date.now();
    
    // Use the validatedBody from secure handler instead of reading body again
    const body = validatedBody;
    
    // Validate the request body using Zod schema
    const parsedBody = SilentBatchRequestSchema.parse(body);
  
  logger.info('启动静默批量打开任务', {
    taskId: parsedBody.taskId,
    urlCount: parsedBody.urls.length,
    cycleCount: parsedBody.cycleCount,
    proxyUrl: parsedBody.proxyUrl,
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date().toISOString(),
    userId: user?.id
  });

  // 检查任务是否已经存在
  const existingTask = silentBatchTaskManager.getTask(parsedBody.taskId);
  if (existingTask && existingTask.status === 'running') {
    throw new BusinessRuleError(
      'TASK_ALREADY_RUNNING',
      '任务已在运行中，请勿重复启动',
      { 
        taskId: parsedBody.taskId,
        currentStatus: existingTask.status 
      }
    );
  }

    // 预计算总访问次数
    let actualTotalVisits = parsedBody.actualTotalVisits;
    if (!actualTotalVisits) {
      actualTotalVisits = parsedBody.urls.length * parsedBody.cycleCount;
    }
    
    // 获取代理地理位置信息（如果启用优化）
    let proxyGeoInfo: any = null;
    if (parsedBody.proxyUrl) {
      try {
        // 这里可以调用代理服务获取地理位置信息
        // 暂时使用默认值
        proxyGeoInfo = {
          country: 'US',
          region: 'California',
          city: 'San Francisco',
          timezone: 'America/Los_Angeles'
        };
      } catch (error) {
        logger.warn('获取代理地理位置信息失败', { error });
      }
    }

    // 构建简化的任务执行选项
    const taskOptions: TaskExecutionOptions = {
      taskId: parsedBody.taskId,
      urls: parsedBody.urls,
      cycleCount: parsedBody.cycleCount,
      openInterval: parsedBody.openInterval || 0, // 默认为0，依靠并发机制控制
      proxyUrl: parsedBody.proxyUrl || '',
      refererOption: parsedBody.refererOption || 'social',
      selectedSocialMedia: parsedBody.selectedSocialMedia,
      customReferer: parsedBody.customReferer,
      proxyValidated: parsedBody.proxyValidated,
      concurrencyLimit: getConcurrencyLimit(actualTotalVisits || parsedBody.urls.length * parsedBody.cycleCount),
      isSilentMode: true,
      urlVisits: parsedBody.urlVisits,
      actualTotalVisits,
      useSingleProxyStrategy: parsedBody.useSingleProxyStrategy ?? false, // 默认禁用单代理策略以避免代理不足时任务失败
      // 新增并发执行配置
      enableConcurrentExecution: parsedBody.enableConcurrentExecution || false,
      maxConcurrency: parsedBody.maxConcurrency || 3,
      proxyReuseInterval: parsedBody.proxyReuseInterval || 1000,
      // 启用简单双层并发以优化执行效率
      enableSimpleConcurrency: true,
      enableRoundConcurrency: true,
      maxConcurrentRounds: Math.min(parsedBody.cycleCount, 2), // 最多2个轮次并发，降低内存压力
      enableUrlConcurrency: true,
      maxConcurrentUrls: Math.min(parsedBody.urls.length, 3), // 每个轮次最多3个URL并发，降低内存压力
      proxyGeoInfo: proxyGeoInfo,
      accessMode: parsedBody.accessMode || 'http'
    };

    // 添加调试日志来跟踪参数传递
    logger.info('API received request with referer options:', {
      refererOption: parsedBody.refererOption,
      selectedSocialMedia: parsedBody.selectedSocialMedia || '[undefined]',
      customReferer: parsedBody.customReferer || '[undefined]'
    });

    logger.info('Task options being passed to executor:', {
      taskId: parsedBody.taskId,
      refererOption: taskOptions.refererOption,
      selectedSocialMedia: taskOptions.selectedSocialMedia || '[undefined]',
      customReferer: taskOptions.customReferer || '[undefined]'
    });

    // 设置初始任务状态
    const totalVisits = actualTotalVisits || (parsedBody.urls.length * parsedBody.cycleCount);
    const initialTaskState = {
      status: 'running' as const,
      progress: 1,
      total: totalVisits,
      startTime: Date.now(),
      message: '任务初始化...'
    };
    await silentBatchTaskManager.setTask(parsedBody.taskId, initialTaskState);
    
    logger.info('✅ 初始任务状态已设置', {
      taskId: parsedBody.taskId,
      progress: 1,
      total: totalVisits,
      message: '任务初始化...'
    });

    // 异步执行任务并保存结果
    executeBatchTask(taskOptions).then(async (result) => {
      // 保存任务结果
      await resultService.saveResult({
        taskId: parsedBody.taskId,
        success: result.success,
        completed: result.completed,
        failed: result.failed,
        duration: result.duration,
        errors: result.errors,
        errorSummary: result.errorSummary,
        timestamp: Date.now()
      });
      
      logger.info('任务结果已保存', {
        taskId: parsedBody.taskId,
        success: result.success,
        completed: result.completed,
        failed: result.failed
      });
      
    }).catch(async (error) => {
      logger.error('任务执行异常', error instanceof Error ? error : new Error(String(error)), { 
        taskId: parsedBody.taskId
      });
      
      // 保存失败结果
      await resultService.saveResult({
        taskId: parsedBody.taskId,
        success: false,
        completed: 0,
        failed: 0,
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
        timestamp: Date.now()
      });
      
      // 确保任务状态在异常情况下也被正确设置
      const existingTask = silentBatchTaskManager.getTask(parsedBody.taskId);
      await silentBatchTaskManager.setTask(parsedBody.taskId, {
        status: 'failed',
        progress: existingTask?.progress || 0,
        total: existingTask?.total || 0,
        startTime: existingTask?.startTime || Date.now(),
        endTime: Date.now(),
        message: '任务执行异常: ' + (error instanceof Error ? error.message : String(error))
      });
    });

    const responseData = {
      taskId: parsedBody.taskId,
      status: 'running',
      // 优化后的预估时间：考虑并发效果，预计可提升3-5倍效率
      estimatedDuration: Math.ceil((parsedBody.urls.length * parsedBody.cycleCount * 1000) / Math.min(parsedBody.cycleCount, 3) / 5), // 考虑并发效果，除以5作为并发优化因子
      totalUrls: parsedBody.urls.length,
      cycleCount: parsedBody.cycleCount,
      totalVisits: actualTotalVisits || (parsedBody.urls.length * parsedBody.cycleCount),
      // 简化的代理信息
      proxyManagement: {
        useSimplifiedService: true,
        estimatedProxyCount: parsedBody.cycleCount,
        allocationStrategy: 'round-robin',
        optimizationEnabled: true,
        optimizationNote: '启用代理级并发，每个代理IP独立完成一轮URL访问'
      }
    };
    
    const duration = Date.now() - startTime;
    logger.info('任务启动成功', {
      taskId: parsedBody.taskId,
      duration: `${duration}ms`
    });
    
    return responseData;

  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'INVALID_REQUEST_DATA',
        '请求参数验证失败',
        { 
          errors: error.errors,
          details: error.message 
        }
      );
    }
    
    // Errors are now handled by the middleware
    throw error;
  }
}

// Create subscription-based handler with feature permission checking
const baseHandler = requireFeature('batchopen_basic', async (request: NextRequest, context: any) => {
  // Extract validated body from request
  const body = await request.json();
  
  // Handle the POST request with subscription context
  const result = await handlePOST(request, { 
    ...context, 
    validatedBody: body 
  });
  
  return NextResponse.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date().toISOString(),
      features: context.features.map((f: any) => f.featureId),
      limits: context.limits
    }
  });
}, {
  checkQuota: true,
  requireActiveSubscription: true
});

// 包装处理器以添加监控和并发限制
const enhancedHandler = withFeatureMonitoring('batchopen', async (request: NextRequest) => {
  // 使用并发限制中间件
  return withConcurrentLimit(async (req: NextRequest) => {
    // 直接执行订阅基础的处理器（速率限制已在订阅处理器中处理）
    return baseHandler(request);
  })(request);
});

export const POST = enhancedHandler;
