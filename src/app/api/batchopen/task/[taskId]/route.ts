import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from "@/lib/utils/security/secure-logger";

const logger = createLogger('TaskStatusAPI');

// 强制动态渲染
export const dynamic = 'force-dynamic';

async function getHandler(request: NextRequest, { params }: { params: { taskId: string } }) {
  try {
    const taskId = params.taskId;
    
    // 重定向到 silent-progress 端点
    const progressUrl = new URL(`/api/batchopen/silent-progress?taskId=${taskId}`, request.url);
    
    logger.debug('重定向任务状态查询', { 
      from: `/api/batchopen/task/${taskId}`,
      to: progressUrl.toString()
    });
    
    return NextResponse.redirect(progressUrl);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const taskId = params.taskId;
    
    logger.error('任务状态查询失败', { 
      error: error instanceof Error ? error : new Error(errorMessage),
      taskId 
    });
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      taskId
    }, { status: 500 });
  }
}

export const GET = getHandler;