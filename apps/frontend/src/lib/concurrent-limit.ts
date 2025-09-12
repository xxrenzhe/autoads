import { createLogger } from './utils/security/secure-logger';
import { NextRequest } from 'next/server';

const logger = createLogger('ConcurrentLimit');

// 用户并发会话管理
export class ConcurrentLimiter {
  private userSessions: Map<string, number> = new Map();
  private maxConcurrentSessions: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxConcurrentSessions: number = 5) {
    this.maxConcurrentSessions = maxConcurrentSessions;
    
    // 定期清理过期的会话记录
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  // 检查用户是否可以创建新会话
  async canCreateSession(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const currentSessions = this.userSessions.get(userId) || 0;
    
    if (currentSessions >= this.maxConcurrentSessions) {
      logger.warn('User concurrent session limit exceeded', { userId, currentSessions, max: this.maxConcurrentSessions });
      return { 
        allowed: false, 
        reason: `并发会话数超过限制（最多${this.maxConcurrentSessions}个）` 
      };
    }
    
    return { allowed: true };
  }

  // 创建新会话
  async createSession(userId: string): Promise<void> {
    const current = this.userSessions.get(userId) || 0;
    this.userSessions.set(userId, current + 1);
    
    logger.debug('Session created', { userId, totalSessions: current + 1 });
  }

  // 释放会话
  async releaseSession(userId: string): Promise<void> {
    const current = this.userSessions.get(userId) || 0;
    if (current > 0) {
      this.userSessions.set(userId, current - 1);
      logger.debug('Session released', { userId, remainingSessions: current - 1 });
    }
  }

  // 清理过期的记录
  private cleanup(): void {
    for (const [userId, count] of this.userSessions.entries()) {
      if (count <= 0) {
        this.userSessions.delete(userId);
      }
    }
  }

  // 获取用户当前会话数
  getUserSessionCount(userId: string): number {
    return this.userSessions.get(userId) || 0;
  }

  // 销毁实例
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.userSessions.clear();
  }
}

// 全局并发限制器实例
export const concurrentLimiter = new ConcurrentLimiter();

// 并发限制中间件
export function withConcurrentLimit<T extends (req: NextRequest, userId: string, ...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async function(this: any, req: NextRequest, userId: string, ...args: any[]): Promise<any> {
    // 从请求中获取用户ID
    const extractedUserId = req.headers.get('x-user-id') || 
                          req.cookies.get('user-id')?.value ||
                          req.nextUrl.searchParams.get('userId') as string ||
                          userId;
    
    if (!extractedUserId) {
      // 未认证用户，允许访问但限制更严格
      return handler.call(this, req, 'anonymous', ...args);
    }

    // 检查并发限制
    const { allowed, reason } = await concurrentLimiter.canCreateSession(extractedUserId);
    
    if (!allowed) {
      return new Response(JSON.stringify({
        error: 'Concurrent Limit Exceeded',
        message: reason
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      });
    }

    // 创建会话记录
    await concurrentLimiter.createSession(extractedUserId);
    
    try {
      // 执行处理器
      const result = await handler.call(this, req, extractedUserId, ...args);
      return result;
    } finally {
      // 无论成功失败，都释放会话
      await concurrentLimiter.releaseSession(extractedUserId);
    }
  } as unknown) as T;
}