import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth/v5-config";
import { authOptions } from '@/lib/auth';
import { AutoClickService } from '@/lib/autoclick-service';

const autoClickService = new AutoClickService();

// GET /api/autoclick/stats - 获取系统统计
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

    const stats = await autoClickService.getSystemStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system stats' },
      { status: 500 }
    );
  }
}