import { createLogger } from './utils/security/secure-logger';
import Redis from 'ioredis';

const logger = createLogger('SessionManager');

// 会话信息接口
export interface UserSession {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

// 会话管理器
export class SessionManager {
  private redis: Redis | null = null;
  private sessionPrefix: string = 'session';
  private userSessionsPrefix: string = 'user_sessions';
  private maxSessionsPerUser: number = 10;
  private sessionTimeout: number = 3600; // 1小时

  constructor() {
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
    }
  }

  // 创建新会话
  async createSession(session: Omit<UserSession, 'id' | 'createdAt' | 'lastActiveAt'>): Promise<string> {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const fullSession: UserSession = {
      ...session,
      id: sessionId,
      createdAt: now,
      lastActiveAt: now
    };

    try {
      if (this.redis) {
        // 存储会话信息
        await this.redis.setex(
          `${this.sessionPrefix}:${sessionId}`,
          this.sessionTimeout,
          JSON.stringify(fullSession)
        );

        // 添加到用户的会话列表
        await this.redis.zadd(
          `${this.userSessionsPrefix}:${session.userId}`,
          now.getTime(),
          sessionId
        );

        // 清理过期会话
        await this.cleanupUserSessions(session.userId);

        logger.info('Session created', { sessionId, userId: session.userId });
      }
    } catch (error) {
      logger.error('Failed to create session', { sessionId, error });
    }

    return sessionId;
  }

  // 获取会话信息
  async getSession(sessionId: string): Promise<UserSession | null> {
    try {
      if (this.redis) {
        const data = await this.redis.get(`${this.sessionPrefix}:${sessionId}`);
        if (data) {
          const session = JSON.parse(data) as UserSession;
          
          // 更新最后活跃时间
          session.lastActiveAt = new Date();
          await this.updateSession(sessionId, session);
          
          return session;
        }
      }
    } catch (error) {
      logger.error('Failed to get session', { sessionId, error });
    }
    
    return null;
  }

  // 更新会话信息
  async updateSession(sessionId: string, updates: Partial<UserSession>): Promise<void> {
    try {
      if (this.redis) {
        const data = await this.redis.get(`${this.sessionPrefix}:${sessionId}`);
        if (data) {
          const session = { ...JSON.parse(data), ...updates };
          await this.redis.setex(
            `${this.sessionPrefix}:${sessionId}`,
            this.sessionTimeout,
            JSON.stringify(session)
          );
        }
      }
    } catch (error) {
      logger.error('Failed to update session', { sessionId, error });
    }
  }

  // 删除会话
  async deleteSession(sessionId: string): Promise<void> {
    try {
      if (this.redis) {
        const data = await this.redis.get(`${this.sessionPrefix}:${sessionId}`);
        if (data) {
          const session = JSON.parse(data) as UserSession;
          
          // 删除会话
          await this.redis.del(`${this.sessionPrefix}:${sessionId}`);
          
          // 从用户的会话列表中移除
          await this.redis.zrem(`${this.userSessionsPrefix}:${session.userId}`, sessionId);
          
          logger.info('Session deleted', { sessionId, userId: session.userId });
        }
      }
    } catch (error) {
      logger.error('Failed to delete session', { sessionId, error });
    }
  }

  // 获取用户的所有活跃会话
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const sessions: UserSession[] = [];
    
    try {
      if (this.redis) {
        // 获取用户的所有会话ID
        const sessionIds = await this.redis.zrevrange(
          `${this.userSessionsPrefix}:${userId}`,
          0,
          -1
        );

        // 批量获取会话信息
        const pipeline = this.redis.pipeline();
        for (const sessionId of sessionIds) {
          pipeline.get(`${this.sessionPrefix}:${sessionId}`);
        }

        const results = await pipeline.exec();
        
        if (results) {
          for (const [error, data] of results) {
            if (!error && data) {
              const session = JSON.parse(data as string) as UserSession;
              if (session.isActive) {
                sessions.push(session);
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to get user sessions', { userId, error });
    }

    return sessions;
  }

  // 清理用户的过期会话
  private async cleanupUserSessions(userId: string): Promise<void> {
    try {
      if (this.redis) {
        const sessionIds = await this.redis.zrange(
          `${this.userSessionsPrefix}:${userId}`,
          0,
          -1
        );

        // 检查每个会话是否存在
        const pipeline = this.redis.pipeline();
        let hasExpired = false;

        for (const sessionId of sessionIds) {
          pipeline.exists(`${this.sessionPrefix}:${sessionId}`);
        }

        const results = await pipeline.exec();
        
        if (results) {
          for (let i = 0; i < results.length; i++) {
            const [error, exists] = results[i];
            if (!error && exists === 0) {
              // 会话已过期，从列表中移除
              await this.redis.zrem(`${this.userSessionsPrefix}:${userId}`, sessionIds[i]);
              hasExpired = true;
            }
          }
        }

        // 如果有过期会话，检查会话数量
        if (hasExpired || sessionIds.length > this.maxSessionsPerUser) {
          const currentSessions = await this.redis.zcard(
            `${this.userSessionsPrefix}:${userId}`
          );

          if (currentSessions > this.maxSessionsPerUser) {
            // 移除最旧的会话
            const toRemove = currentSessions - this.maxSessionsPerUser;
            const oldestSessions = await this.redis.zrange(
              `${this.userSessionsPrefix}:${userId}`,
              0,
              toRemove - 1
            );

            for (const sessionId of oldestSessions) {
              await this.redis.del(`${this.sessionPrefix}:${sessionId}`);
              await this.redis.zrem(`${this.userSessionsPrefix}:${userId}`, sessionId);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup user sessions', { userId, error });
    }
  }

  // 强制终止用户的所有会话（除了当前会话）
  async terminateAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    let terminatedCount = 0;
    
    try {
      if (this.redis) {
        const sessions = await this.getUserSessions(userId);
        
        for (const session of sessions) {
          if (session.id !== exceptSessionId && session.isActive) {
            await this.deleteSession(session.id);
            terminatedCount++;
          }
        }
        
        logger.info('Terminated user sessions', { 
          userId, 
          terminatedCount, 
          exceptSessionId 
        });
      }
    } catch (error) {
      logger.error('Failed to terminate user sessions', { userId, error });
    }

    return terminatedCount;
  }

  // 检查会话是否活跃
  async isSessionActive(sessionId: string): Promise<boolean> {
    try {
      if (this.redis) {
        const exists = await this.redis.exists(`${this.sessionPrefix}:${sessionId}`);
        return exists === 1;
      }
    } catch (error) {
      logger.error('Failed to check session activity', { sessionId, error });
    }
    
    return false;
  }

  // 获取会话统计
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeUsers: number;
    averageSessionsPerUser: number;
  }> {
    try {
      if (this.redis) {
        // 获取所有用户会话键
        const userSessionKeys = await this.redis.keys(`${this.userSessionsPrefix}:*`);
        
        let totalSessions = 0;
        const sessionCounts: number[] = [];

        for (const key of userSessionKeys) {
          const count = await this.redis.zcard(key);
          totalSessions += count;
          sessionCounts.push(count);
        }

        const averageSessionsPerUser = sessionCounts.length > 0 
          ? totalSessions / sessionCounts.length 
          : 0;

        return {
          totalSessions,
          activeUsers: userSessionKeys.length,
          averageSessionsPerUser
        };
      }
    } catch (error) {
      logger.error('Failed to get session stats', { error });
    }

    return {
      totalSessions: 0,
      activeUsers: 0,
      averageSessionsPerUser: 0
    };
  }
}

// 全局会话管理器实例
export const sessionManager = new SessionManager();