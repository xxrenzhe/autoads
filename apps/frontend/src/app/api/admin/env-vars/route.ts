import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { hotReloadService } from '@/lib/hot-reload';

// GET /api/admin/env-vars - 获取环境变量
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const envVars = await prisma.environmentVariable.findMany({
      select: {
        id: true,
        key: true,
        value: true,
        isSecret: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        key: 'asc',
      },
    });

    // 对于非超级管理员，隐藏秘密值
    const filteredEnvVars = envVars.map((envVar: any) => ({
      ...envVar,
      value: session.user?.role === 'SUPER_ADMIN' || !envVar.isSecret 
        ? envVar.value 
        : '********',
    }));

    return NextResponse.json(filteredEnvVars);
  } catch (error) {
    console.error('Error fetching environment variables:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/env-vars - 创建或更新环境变量
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, key, value, isSecret, isHotReload } = await request.json();

    let envVar;
    
    if (id) {
      // 更新现有环境变量
      envVar = await prisma.environmentVariable.update({
        where: { id },
        data: {
          value,
          isSecret,
          updatedBy: session.user?.id || '',
        },
      });
    } else {
      // 创建新环境变量
      envVar = await prisma.environmentVariable.create({
        data: {
          key,
          value,
          isSecret,
          createdBy: session.user?.id || '',
        },
      });
    }

    // 记录管理员操作
    await prisma.adminLog.create({
      data: {
        action: id ? 'UPDATE_ENV_VAR' : 'CREATE_ENV_VAR',
        details: {
          envVarId: envVar.id,
          key: envVar.key,
          isSecret: envVar.isSecret,
          action: id ? 'update' : 'create',
          updatedBy: session.user.email,
        },
        userId: session.user.id || '',
      },
    });

    // 如果是热重载配置，触发热重载
    if (isHotReload) {
      try {
        await hotReloadService.triggerReload({
          type: 'env',
          action: id ? 'update' : 'create',
          key: envVar.key,
          data: envVar,
          timestamp: Date.now()
        });
        console.log('Hot reload triggered for env var:', key);
      } catch (error) {
        console.error('Hot reload failed:', error);
      }
    }

    return NextResponse.json(envVar);
  } catch (error) {
    console.error('Error saving environment variable:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/env-vars/[id] - 删除环境变量
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const envVar = await prisma.environmentVariable.delete({
      where: { id: params.id },
    });

    // 记录管理员操作
    await prisma.adminLog.create({
      data: {
        action: 'DELETE_ENV_VAR',
        details: {
          envVarId: envVar.id,
          key: envVar.key,
          deletedBy: session.user?.email,
        },
        userId: session.user.id || '',
      },
    });

    // 触发热重载
    try {
      await hotReloadService.triggerReload({
        type: 'env',
        action: 'delete',
        key: envVar.key,
        data: envVar,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Hot reload failed:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting environment variable:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
