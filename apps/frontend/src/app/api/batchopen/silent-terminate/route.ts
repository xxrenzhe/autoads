import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from "@/lib/utils/security/secure-logger";
import { silentBatchTaskManager } from '@/lib/silent-batch-task-manager';
import { withMiddleware } from '@/lib/middleware/api';
import { auth } from '@/lib/auth/v5-config';
import { requireFeature } from '@/lib/utils/subscription-based-api';
import { withApiProtection } from '@/lib/api-utils';

const logger = createLogger('SilentBatchOpenTerminateAPI');

// 强制动态渲染
export const dynamic = 'force-dynamic';

async function postHandler(request: NextRequest, context: any) {
  const { user, validatedBody } = context;
  try {
    // Authentication is already handled by createSecureHandler
    
    const { taskId } = validatedBody;

    logger.info('收到终止请求:', { taskId, userId: user?.id });

    // 检查任务是否存在
    const task = silentBatchTaskManager.getTask(taskId);
    if (!task) {
      logger.warn('尝试终止不存在的任务:', { taskId });
      return NextResponse.json(
        { success: false, message: '任务不存在' },
        { status: 404 }
      );
    }

    // 检查任务是否属于当前用户
    if (task.userId !== user?.id) {
      logger.warn('用户尝试终止不属于自己的任务:', { taskId, userId: user?.id, taskUserId: task.userId });
      return NextResponse.json(
        { success: false, message: '无权终止此任务' },
        { status: 403 }
      );
    }

    // 设置全局终止标志
    if (!globalThis.globalTerminateFlags) {
      globalThis.globalTerminateFlags = new Set();
    }
    globalThis.globalTerminateFlags.add(taskId);

    // 5分钟后清理终止标志
    setTimeout(() => {
      if (globalThis.globalTerminateFlags) {
        globalThis.globalTerminateFlags.delete(taskId);
        logger.info('清理终止标志:', { taskId });
      }
    }, 5 * 60 * 1000);

    // 尝试通过任务管理器终止任务
    const terminated = await silentBatchTaskManager.terminateTask(taskId);

    if (terminated) {
      logger.info('任务终止成功:', { taskId });
      return NextResponse.json({
        success: true,
        message: '任务终止成功',
        taskId
      });
    } else {
      logger.warn('任务可能已经完成或不存在:', { taskId });
      return NextResponse.json({
        success: true,
        message: '任务已终止或已完成',
        taskId
      });
    }
  } catch (error) {
    logger.error('终止任务时发生错误:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        success: false, 
        message: '终止任务时发生错误',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Apply rate limiting: Standard limit for terminate operations
export const POST = requireFeature(
  'batchopen_basic',
  withApiProtection('batchOpen')(async (request: NextRequest, context: any) => {
    const body = await request.json();
    return postHandler(request, { ...context, validatedBody: body });
  }) as any,
  { customRateLimit: true }
);
