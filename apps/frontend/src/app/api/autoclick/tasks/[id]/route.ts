import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { AutoClickService } from '@/lib/autoclick-service';
import { UpdateAutoClickTaskInput } from '@/types/autoclick';

const autoClickService = new AutoClickService();

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/autoclick/tasks/[id] - 获取单个任务
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user?.role === 'ADMIN';
    const task = await autoClickService.getTaskById(params.id, isAdmin ? undefined : session.userId);
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching autoclick task:', error);
    if (error instanceof Error && error.message === 'Task not found') {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PUT /api/autoclick/tasks/[id] - 更新任务
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user?.role === 'ADMIN';
    const body = await request.json();
    const input: UpdateAutoClickTaskInput = {
      offerUrl: body.offerUrl,
      country: body.country,
      timeWindow: body.timeWindow,
      dailyClicks: body.dailyClicks ? parseInt(body.dailyClicks) : undefined,
      referer: body.referer,
      status: body.status
    };

    const task = await autoClickService.updateTask(params.id, isAdmin ? undefined : session.user.id, input);
    
    // 记录用户活动
    // TODO: 集成到 UserActivity 系统
    
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error updating autoclick task:', error);
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
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/autoclick/tasks/[id] - 删除任务
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user?.role === 'ADMIN';
    await autoClickService.deleteTask(params.id, isAdmin ? undefined : session.user.id);
    
    // 记录用户活动
    // TODO: 集成到 UserActivity 系统
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting autoclick task:', error);
    if (error instanceof Error && error.message === 'Task not found') {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}