import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth/v5-config";
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/autoclick/tasks/[id]/live - 实时任务进度（Server-Sent Events）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const taskId = params.id;

    // 验证任务所有权
    const task = await prisma.autoClickTask.findFirst({
      where: {
        id: taskId,
        userId: session.userId
      }
    });

    if (!task) {
      return new Response('Task not found', { status: 404 });
    }

    // 创建Server-Sent Events流
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // 发送初始数据
        const initialData = await getProgressData(taskId);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

        // 设置定时器，每5秒发送一次更新
        const interval = setInterval(async () => {
          try {
            const data = await getProgressData(taskId);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (error) {
            console.error('Error sending progress update:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Failed to fetch progress' })}\n\n`));
          }
        }, 5000);

        // 清理函数
        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          controller.close();
        });

        // 30分钟后自动关闭连接
        setTimeout(() => {
          clearInterval(interval);
          controller.close();
        }, 30 * 60 * 1000);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Error setting up live progress:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// 获取进度数据的辅助函数
async function getProgressData(taskId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plan = await prisma.dailyExecutionPlan.findFirst({
    where: {
      taskId,
      executionDate: today
    },
    include: {
      task: {
        select: {
          status: true,
          dailyClicks: true
        }
      },
      hourlyExecutions: {
        orderBy: { hour: 'asc' }
      }
    }
  });

  if (!plan) {
    return {
      taskId,
      status: 'no_plan',
      progress: null,
      timestamp: new Date().toISOString()
    };
  }

  const totalTarget = plan.task.dailyClicks;
  const totalCompleted = plan.hourlyExecutions.reduce((sum: number, exec: any) => sum + exec.successCount, 0);
  const currentHour = new Date().getHours();
  
  // 获取当前小时的执行情况
  const currentExecution = plan.hourlyExecutions.find((exec: any) => exec.hour === currentHour);
  const hourlyProgress = currentExecution ? {
    target: plan.hourlyClicks[currentHour] || 0,
    completed: currentExecution.successCount,
    failed: currentExecution.failCount,
    isRunning: currentExecution.actualClicks < (plan.hourlyClicks[currentHour] || 0)
  } : null;

  return {
    taskId,
    status: plan.task.status,
    progress: {
      total: {
        target: totalTarget,
        completed: totalCompleted,
        percentage: totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0
      },
      hourly: hourlyProgress,
      lastUpdate: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
}