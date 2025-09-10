import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';
import { withMiddleware } from '@/lib/middleware/api';
import { auth } from '@/lib/auth/v5-config';
import { requireFeature } from '@/lib/utils/subscription-based-api';

const logger = createLogger('SilentBatchOpenProgressAPI');

// 强制动态渲染
export const dynamic = 'force-dynamic';

// Connection health check
async function checkConnectionHealth(): Promise<boolean> {
  try {
    // Check if task manager is accessible
    const tasks = silentBatchTaskManager.getAllTasks();
    return Array.isArray(tasks);
  } catch (error) {
    logger.error('Connection health check failed', error instanceof Error ? error : new Error(String(error)));
    return Promise.resolve(false);
  }
}

// Enhanced response headers for better connection handling
function getResponseHeaders() {
  return {
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=30',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
}

async function getHandler(request: NextRequest, context: any) {
  const { user } = context;
  const startTime = Date.now();
  
  try {
    // Authentication is already handled by createSecureHandler
    
    // Check connection health first
    const isHealthy = await checkConnectionHealth();
    if (!isHealthy) {
      logger.error('Connection health check failed');
      // Don't immediately fail - try to proceed with the request
      // This prevents false positives when the task manager is actually working
      logger.warn('Connection health check failed, but attempting to proceed with request');
    }
    
    const { searchParams } = request.nextUrl;
    const taskId = searchParams.get('taskId');
    
    logger.debug('查询任务进度', { taskId });

    if (!taskId) {
      return NextResponse.json({
        success: false,
        message: '缺少taskId参数',
        code: 'MISSING_TASK_ID'
      }, { 
        status: 400,
        headers: getResponseHeaders()
      });
    }

    // 从任务管理器获取任务状态
    const taskStatus = silentBatchTaskManager.getTask(taskId);

    if (!taskStatus) {
      // 检查是否是刚启动的任务，可能还在初始化中
      const now = Date.now();
      const taskTimestamp = parseInt(taskId.split('_')[1] || '0');
      const taskAge = now - taskTimestamp;
      const isRecentTask = taskAge < 5000; // 5秒内创建的任务
      
      if (isRecentTask) {
        // 对于新创建的任务，返回初始化状态而不是404
        logger.info('任务刚创建，返回初始化状态', { taskId, taskTimestamp, now });
        return NextResponse.json({
          success: true,
          status: 'running',
          progress: 1,
          successCount: 0,
          failCount: 0,
          total: 0,
          pendingCount: 0,
          message: '任务初始化...',
          proxyPhase: 'initialization',
          phaseStatus: 'running',
          completedPhases: [],
          phaseProgress: {
            initialization: {
              startTime: now,
              status: 'running',
              progress: 0
            }
          },
          lastProgressUpdate: now,
          timestamp: now,
          serverTime: new Date().toISOString()
        }, {
          headers: getResponseHeaders()
        });
      }
      
      // 检查是否是已完成的任务（5-15分钟之间的任务可能是已完成但被清理的）
      if (taskAge > 5 * 60 * 1000 && taskAge < 15 * 60 * 1000) {
        logger.info('任务可能已完成并被清理，返回完成状态', { taskId, taskAge });
        return NextResponse.json({
          success: true,
          status: 'completed',
          progress: 100,
          successCount: -1, // -1表示无法获取准确计数
          failCount: -1,
          total: -1,
          pendingCount: 0,
          message: '任务已完成',
          proxyPhase: 'completed',
          phaseStatus: 'completed',
          completedPhases: ['initialization', 'proxy-validation', 'proxy-acquisition', 'proxy-distribution', 'batch-execution'],
          phaseProgress: {
            completed: {
              startTime: now,
              status: 'completed',
              endTime: now,
              progress: 100
            }
          },
          lastProgressUpdate: now,
          timestamp: now,
          serverTime: new Date().toISOString(),
          note: 'Task was completed and cleaned up'
        }, {
          headers: getResponseHeaders()
        });
      }
      
      return NextResponse.json({
        success: false,
        message: '任务不存在',
        code: 'TASK_NOT_FOUND'
      }, { 
        status: 404,
        headers: getResponseHeaders()
      });
    }

    logger.info(`查询任务进度: ${taskId}`, taskStatus);
    logger.debug('任务状态详情', {
      taskId,
      status: taskStatus.status,
      progress: taskStatus.progress,
      successCount: taskStatus.successCount,
      failCount: taskStatus.failCount,
      message: taskStatus.message,
      lastProgressUpdate: taskStatus.lastProgressUpdate,
      updatedAt: taskStatus.updatedAt
    });
    
    // 额外的调试信息 - 检查任务状态是否正确
    logger.info('🔍 任务状态检查', {
      taskId,
      exists: !!taskStatus,
      status: taskStatus?.status,
      progress: taskStatus?.progress,
      message: taskStatus?.message,
      timestamp: Date.now(),
      lastUpdate: taskStatus?.lastProgressUpdate || taskStatus?.updatedAt
    });
    
    // 检测异常状态并记录警告
    if (taskStatus.progress === null || taskStatus.progress === undefined) {
      logger.warn('任务进度为null或undefined', {
        taskId,
        status: taskStatus.status,
        progress: taskStatus.progress,
        message: taskStatus.message
      });
    }
    
    // 检测长时间未更新的任务 - 增强版防止误判
    const now = Date.now();
    const lastUpdate = taskStatus.lastProgressUpdate || taskStatus.updatedAt;
    const staleTime = 3 * 60 * 1000; // 3分钟基准时间
    
    // 增强的智能检测：考虑任务进度和消息特征
    let isLikelyStuck = false;
    let stuckReason = '';
    
    if (now - lastUpdate > staleTime && taskStatus.status === 'running') {
      // 检查是否在代理获取阶段（此阶段可能较慢）
      const isInProxyPhase = taskStatus.message && (
        taskStatus.message.includes('代理获取') ||
        taskStatus.message.includes('代理验证') ||
        taskStatus.message.includes('正在获取代理') ||
        taskStatus.message.includes('初始化')
      );
      
      // 检查进度是否有变化
      const hasProgress = taskStatus.progress > 0;
      const isNearCompletion = taskStatus.progress >= taskStatus.total * 0.9; // 90%以上
      
      // 智能判断：如果在代理阶段或进度较高，给予更多时间
      if (isInProxyPhase) {
        // 代理阶段给予更长容忍时间（5分钟）
        const proxyStaleTime = 5 * 60 * 1000;
        if (now - lastUpdate > proxyStaleTime) {
          isLikelyStuck = true;
          stuckReason = '代理阶段超时';
        }
      } else if (isNearCompletion) {
        // 接近完成的任务给予更长容忍时间（4分钟）
        const nearCompleteStaleTime = 4 * 60 * 1000;
        if (now - lastUpdate > nearCompleteStaleTime) {
          isLikelyStuck = true;
          stuckReason = '接近完成但卡住';
        }
      } else {
        // 普通任务使用标准时间
        isLikelyStuck = true;
        stuckReason = '标准超时';
      }
      
      if (isLikelyStuck) {
        logger.warn('任务长时间未更新，可能已卡住', {
          taskId,
          status: taskStatus.status,
          progress: taskStatus.progress,
          total: taskStatus.total,
          lastUpdate: new Date(lastUpdate).toISOString(),
          staleTime: `${staleTime}ms`,
          currentTime: new Date(now).toISOString(),
          stuckReason,
          message: taskStatus.message
        });
        
        // 在标记失败前，先检查是否设置了全局终止标志
        if (globalThis.globalTerminateFlags && globalThis.globalTerminateFlags.has(taskId)) {
          logger.info('检测到终止标志，任务应该被终止而非标记失败', { taskId });
          // 返回终止状态而不是失败
          return NextResponse.json({
            success: true,
            status: 'terminated',
            progress: taskStatus.progress,
            successCount: taskStatus.successCount || 0,
            failCount: taskStatus.failCount || 0,
            total: taskStatus.total || 0,
            pendingCount: taskStatus.pendingCount || 0,
            message: '任务已终止',
            proxyPhase: 'terminated',
            phaseStatus: 'failed',
            completedPhases: taskStatus.completedPhases || [],
            phaseProgress: {
              ...taskStatus.phaseProgress,
              terminated: {
                startTime: now,
                status: 'failed',
                endTime: now
              }
            },
            lastProgressUpdate: now,
            timestamp: now,
            serverTime: new Date().toISOString(),
            terminated: true
          }, {
            headers: getResponseHeaders()
          });
        }
        
        // 只有确定卡住才标记为失败
        logger.warn('自动将卡住的任务标记为失败', { taskId, stuckReason });
        try {
          await silentBatchTaskManager.setTask(taskId, {
            ...taskStatus,
            status: 'failed',
            endTime: now,
            message: `任务执行超时：超过${staleTime/1000/60}分钟未更新进度`
          });
          
          logger.warn('已将卡住的任务标记为失败', { taskId });
          
          return NextResponse.json({
            success: false,
            status: 'failed',
            progress: taskStatus.progress,
            successCount: taskStatus.successCount || 0,
            failCount: taskStatus.failCount || 0,
            total: taskStatus.total || 0,
            pendingCount: taskStatus.pendingCount || 0,
            message: `任务执行超时：超过${staleTime/1000/60}分钟未更新进度`,
            lastProgressUpdate: now,
            timestamp: now,
            serverTime: new Date().toISOString()
          }, {
            headers: getResponseHeaders()
          });
        } catch (error) {
          logger.error('自动标记卡住任务失败', error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    // 确保进度至少为1%，避免显示0%
    const validatedProgress = Math.max(1, taskStatus.progress ?? 0);
    
    // 代理操作统计已移除（简化设计）
    
    // 构建响应数据
    const responseData: any = {
      success: true,
      status: taskStatus.status,
      progress: validatedProgress,
      successCount: taskStatus.successCount ?? 0,
      failCount: taskStatus.failCount ?? 0,
      total: taskStatus.total ?? 0,
      pendingCount: taskStatus.pendingCount ?? Math.max(0, (taskStatus.total ?? 0) - (taskStatus.successCount ?? 0) - (taskStatus.failCount ?? 0)),
      message: taskStatus.message,
      lastProgressUpdate: taskStatus.lastProgressUpdate || taskStatus.updatedAt,
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    };
    
    // 添加耗时信息（如果任务已完成且有开始和结束时间）
    if (taskStatus.status === 'completed' && taskStatus.startTime && taskStatus.endTime) {
      responseData.duration = taskStatus.endTime - taskStatus.startTime;
      responseData.elapsedTime = taskStatus.endTime - taskStatus.startTime;
    }
    
    // 添加代理相关信息
    if (taskStatus.proxyPhase) {
      responseData.proxyPhase = taskStatus.proxyPhase;
    }
    
    if (taskStatus.phaseStatus) {
      responseData.phaseStatus = taskStatus.phaseStatus;
    }
    
    if (taskStatus.completedPhases) {
      responseData.completedPhases = taskStatus.completedPhases;
    }
    
    if (taskStatus.phaseProgress) {
      responseData.phaseProgress = taskStatus.phaseProgress;
    }
    
    if (taskStatus.proxyStats) {
      responseData.proxyStats = taskStatus.proxyStats;
    }
    
    // 代理操作统计信息已移除（简化设计）
    
    // 添加代理短缺警告信息
    if (taskStatus.proxyShortageWarning) {
      responseData.proxyShortageWarning = taskStatus.proxyShortageWarning;
    }
    
    const response = NextResponse.json(responseData, {
      headers: getResponseHeaders()
    });
    
    const duration = Date.now() - startTime;
    
    // Add performance header
    response.headers.set('X-Response-Time', `${duration}ms`);
    
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const { searchParams } = request.nextUrl;
    const taskId = searchParams.get('taskId') || 'unknown';
    
    logger.error('查询进度失败', { 
      error: error instanceof Error ? error : new Error(errorMessage),
      taskId, 
      duration 
    });
    
    // Determine appropriate status code based on error type
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      statusCode = 504;
      errorCode = 'TIMEOUT_ERROR';
    } else if (errorMessage.includes('connection') || errorMessage.includes('fetch')) {
      statusCode = 503;
      errorCode = 'CONNECTION_ERROR';
    } else if (errorMessage.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    }
    
    return NextResponse.json({
      success: false,
      message: '查询进度失败',
      error: errorMessage,
      code: errorCode,
      taskId,
      timestamp: Date.now()
    }, { 
      status: statusCode,
      headers: getResponseHeaders()
    });
  }
}

// Apply rate limiting: Higher limit for progress polling
export const GET = requireFeature('batchopen_basic', async (request: NextRequest, context: any) => {
  return getHandler(request, context);
}, {
  customRateLimit: true
});