import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { AutoClickService } from '@/lib/autoclick-service';

const autoClickService = new AutoClickService();

interface RouteParams {
  params: {
    id: string;
    action: string;
  };
}

// POST /api/autoclick/tasks/[id]/[action] - 任务操作（启动/停止/终止）
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = params;
    const taskId = params.id;

    let result;
    switch (action) {
      case 'start':
        result = await autoClickService.startTask(taskId, session.userId);
        break;
      case 'stop':
        result = await autoClickService.stopTask(taskId, session.userId);
        break;
      case 'terminate':
        result = await autoClickService.terminateTask(taskId, session.userId);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // 记录用户活动
    // TODO: 集成到 UserActivity 系统

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error performing action ${params.action} on task:`, error);
    if (error instanceof Error) {
      if (error.message === 'Task not found') {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}