import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/system/task-status
 * 
 * Admin endpoint to get scheduled task execution status and history
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentUser || !['ADMIN', 'SUPER_ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get recent task executions
    const recentExecutions = await prisma.systemLog.findMany({
      where: {
        action: 'scheduled_task_execution'
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 50
    });

    // Get service start events
    const serviceStarts = await prisma.systemLog.findMany({
      where: {
        action: 'service_start',
        resource: 'scheduled_task_service'
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 10
    });

    // Get task execution statistics
    const taskStats = await prisma.systemLog.groupBy({
      by: ['action'],
      where: {
        action: 'scheduled_task_execution'
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    // Get latest execution for each task
    const latestExecutions = await prisma.systemLog.findMany({
      where: {
        action: 'scheduled_task_execution',
        metadata: {
          path: ['status'],
          equals: 'completed'
        }
      },
      distinct: ['metadata'],
      orderBy: {
        timestamp: 'desc'
      },
      take: 10
    });

    return NextResponse.json({
      recentExecutions,
      serviceStarts,
      taskStats,
      latestExecutions,
      summary: {
        totalExecutions: recentExecutions.length,
        serviceStartCount: serviceStarts.length,
        lastServiceStart: serviceStarts[0]?.timestamp || null
      }
    });

  } catch (error) {
    console.error('Error getting task status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}