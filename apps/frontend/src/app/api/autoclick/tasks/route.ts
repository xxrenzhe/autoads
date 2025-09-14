import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { AutoClickService } from '@/lib/autoclick-service';
import { CreateAutoClickTaskInput } from '@/types/autoclick';
import { withFeatureGuard } from '@/lib/middleware/feature-guard-middleware';

const autoClickService = new AutoClickService();

// GET /api/autoclick/tasks - 获取任务列表
async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isAdmin = session.user?.role === 'ADMIN';
    
    const filters = {
      status: searchParams.get('status') as any,
      country: searchParams.get('country') || undefined,
      userId: isAdmin ? searchParams.get('userId') || undefined : session.user.id,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    };

    const result = await autoClickService.getTasks(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching autoclick tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/autoclick/tasks - 创建任务
async function handlePOST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const input: CreateAutoClickTaskInput = {
      offerUrl: body.offerUrl,
      country: body.country || 'US',
      timeWindow: body.timeWindow,
      dailyClicks: parseInt(body.dailyClicks),
      referer: body.referer
    };

    const task = await autoClickService.createTask(session.userId, input);
    
    // 记录用户活动
    // TODO: 集成到 UserActivity 系统
    
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating autoclick task:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

export const GET = withFeatureGuard(handleGET as any, { featureId: 'batchopen_pro' });
export const POST = withFeatureGuard(handlePOST as any, { featureId: 'batchopen_pro' });
