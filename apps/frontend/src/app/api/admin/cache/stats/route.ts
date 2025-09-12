import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { MultiLevelCacheService } from '@/lib/cache/multi-level-cache';
import { SiteRankCacheService } from '@/lib/cache/siterank-cache';

// 动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/cache/stats
 * 获取缓存统计信息（管理员）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查管理员权限
    const { PermissionService } = await import('@/lib/services/permission-service');
    const isAdmin = await PermissionService.isAdmin(session.user.id);
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // 获取通用缓存统计
    const generalStats = MultiLevelCacheService.getStats();
    
    // 获取SiteRank缓存统计
    const siterankStats = await SiteRankCacheService.getStats();
    
    // 获取Redis信息（如果可用）
    let redisInfo: any = null;
    try {
      const { getRedisClient } = await import('@/lib/cache/redis-client');
      const redis = getRedisClient();
      
      if (redis.status === 'ready') {
        const [memory, info] = await Promise.all([
          redis.info('memory'),
          redis.info('stats')
        ]);
        
        redisInfo = {
          status: redis.status,
          connected: true,
          memory: parseRedisInfo(memory),
          stats: parseRedisInfo(info)
        };
      } else {
        redisInfo = {
          status: redis.status,
          connected: false
        };
      }
    } catch (error) {
      redisInfo = {
        status: 'error',
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      };
    }

    return NextResponse.json({
      general: generalStats,
      siterank: siterankStats,
      redis: redisInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cache/clear
 * 清除缓存（管理员）
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查管理员权限
    const { PermissionService } = await import('@/lib/services/permission-service');
    const isAdmin = await PermissionService.isAdmin(session.user.id);
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { type, tags } = body;

    switch (type) {
      case 'all':
        await MultiLevelCacheService.clear();
        break;
      
      case 'tags':
        if (tags && Array.isArray(tags)) {
          await MultiLevelCacheService.deleteByTags(tags);
        } else {
          return NextResponse.json(
            { error: 'Tags are required for tag-based clearing' },
            { status: 400 }
          );
        }
        break;
      
      case 'siterank':
        await SiteRankCacheService.clearAll();
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid clear type. Use: all, tags, or siterank' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Cache cleared successfully (${type})`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 解析Redis INFO命令输出
 */
function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  info.split('\n').forEach(line => {
    if (line.startsWith('#')) return; // 跳过注释
    
    const parts = line.split(':');
    if (parts.length === 2) {
      result[parts[0].trim()] = parts[1].trim();
    }
  });
  
  return result;
}