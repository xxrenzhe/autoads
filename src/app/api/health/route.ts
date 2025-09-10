import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRedisClient } from '@/lib/cache/redis-client';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  dependencies: {
    database: 'connected' | 'disconnected' | 'error';
    redis: 'connected' | 'disconnected' | 'error' | 'fallback';
    memory: {
      usage: number;
      status: 'normal' | 'warning' | 'critical';
    };
  };
}

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || 'unknown',
    dependencies: {
      database: 'disconnected',
      redis: 'disconnected',
      memory: {
        usage: 0,
        status: 'normal'
      }
    }
  };

  try {
    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.dependencies.database = 'connected';
    } catch (error) {
      console.error('Database health check failed:', error);
      health.dependencies.database = 'error';
      health.status = 'degraded';
    }

    // Check Redis connectivity
    try {
      const redis = getRedisClient();
      await redis.ping();
      health.dependencies.redis = 'connected';
    } catch (error) {
      console.warn('Redis health check failed, using fallback:', error);
      // Redis failure is not critical, app can function without it
      health.dependencies.redis = 'fallback';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const memoryUsagePercent = Math.round((heapUsedMB / heapTotalMB) * 100);
    
    health.dependencies.memory.usage = memoryUsagePercent;
    
    if (memoryUsagePercent > 90) {
      health.dependencies.memory.status = 'critical';
      health.status = health.status === 'healthy' ? 'degraded' : 'unhealthy';
    } else if (memoryUsagePercent > 75) {
      health.dependencies.memory.status = 'warning';
      health.status = health.status === 'healthy' ? 'healthy' : 'degraded';
    }

    // Final status determination
    if (health.dependencies.database === 'error') {
      health.status = 'unhealthy';
    }

    // Add response time
    const responseTime = Date.now() - startTime;
    
    const response = NextResponse.json({
      ...health,
      responseTime
    }, { 
      status: health.status === 'healthy' ? 200 : 
             health.status === 'degraded' ? 200 : 503 
    });
    
    // Cache health checks for 30 seconds to reduce load
    if (health.status === 'healthy') {
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')
    }
    
    return response;

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error" as any,
      uptime: process.uptime()
    }, { status: 503 });
  }
}