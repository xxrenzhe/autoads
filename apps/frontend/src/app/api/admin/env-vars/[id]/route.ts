import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting environment variable:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}