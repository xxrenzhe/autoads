import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth/v5-config";
import { authOptions } from '@/lib/auth';
import { AutoClickService } from '@/lib/autoclick-service';

const autoClickService = new AutoClickService();

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/autoclick/tasks/[id]/progress - 获取任务进度
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const progress = await autoClickService.getTaskProgress(params.id, session.userId);
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching task progress:', error);
    if (error instanceof Error && error.message === 'Task not found') {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch task progress' },
      { status: 500 }
    );
  }
}