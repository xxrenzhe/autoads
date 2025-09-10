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

// GET /api/autoclick/tasks/[id]/records - 获取执行记录
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const records = await autoClickService.getExecutionRecords(
      params.id, 
      session.userId, 
      days
    );
    return NextResponse.json(records);
  } catch (error) {
    console.error('Error fetching execution records:', error);
    if (error instanceof Error && error.message === 'Task not found') {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch execution records' },
      { status: 500 }
    );
  }
}