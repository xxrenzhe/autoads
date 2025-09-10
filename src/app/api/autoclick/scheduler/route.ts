import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth/v5-config";
import { authOptions } from '@/lib/auth';
import { getAutoClickScheduler } from '@/lib/autoclick-init';

// GET /api/autoclick/scheduler/status - 获取调度器状态
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户权限
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scheduler = getAutoClickScheduler();
    
    return NextResponse.json({
      status: scheduler ? 'running' : 'stopped',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduler status' },
      { status: 500 }
    );
  }
}

// POST /api/autoclick/scheduler/trigger - 手动触发调度任务
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查用户权限
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const scheduler = getAutoClickScheduler();
    if (!scheduler) {
      return NextResponse.json({ error: 'Scheduler not initialized' }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'daily-plan':
        result = await scheduler.triggerDailyPlanGeneration();
        break;
      case 'hourly-execution':
        result = await scheduler.triggerHourlyExecution();
        break;
      case 'token-sync':
        result = await scheduler.triggerTokenSync();
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use daily-plan, hourly-execution, or token-sync' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error triggering scheduler action:', error);
    return NextResponse.json(
      { error: 'Failed to trigger action' },
      { status: 500 }
    );
  }
}