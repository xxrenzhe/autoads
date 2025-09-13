/**
 * Session Cookie Manager
 * 管理HTTP会话cookie，实现会话保持
 */

import { createProxyLogger } from '@/lib/utils/proxy-logger';

const logger = createProxyLogger('SessionCookieManager');

export interface HttpCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface SessionData {
  id: string;
  cookies: HttpCookie[];
  headers: Record<string, string>;
  userAgent: string;
  lastUsed: number;
}

export class SessionCookieManager {
  private sessions: Map<string, SessionData> = new Map();
  private maxSessions: number = 10;
  private sessionTimeout: number = 30 * 60 * 1000; // 30分钟

  constructor(options?: {
    maxSessions?: number;
    sessionTimeout?: number;
  }) {
    if (options) {
      this.maxSessions = options.maxSessions ?? this.maxSessions;
      this.sessionTimeout = options.sessionTimeout ?? this.sessionTimeout;
    }
  }

  /**
   * 从HTTP响应保存会话
   */
  async saveSessionFromResponse(
    response: Response,
    sessionId?: string
  ): Promise<string> {
    const id = sessionId || this.generateSessionId();
    
    try {
      // 解析Set-Cookie头
      const cookies = this.parseCookiesFromResponse(response);
      
      // 获取相关头信息
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key: any) => {
        if (key.toLowerCase().includes('auth') || 
            key.toLowerCase().includes('session') ||
            key.toLowerCase().includes('csrf')) {
          headers[key] = value;
        }
      });

      const sessionData: SessionData = {
        id,
        cookies,
        headers,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        lastUsed: Date.now()
      };

      this.sessions.set(id, sessionData);
      
      // 清理过期会话
      this.cleanupExpiredSessions();
      
      logger.info('会话已保存', {
        sessionId: id,
        cookiesCount: cookies.length,
        headersCount: Object.keys(headers).length
      });

      return id;
    } catch (error) {
      logger.error('保存会话失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取会话的请求头
   */
  getSessionHeaders(sessionId: string): Record<string, string> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn('会话不存在', { sessionId });
      return {};
    }

    // 更新最后使用时间
    session.lastUsed = Date.now();

    const headers: Record<string, string> = {
      'User-Agent': session.userAgent,
      ...session.headers
    };

    // 添加Cookie头
    if (session.cookies.length > 0) {
      headers['Cookie'] = session.cookies
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join('; ');
    }

    return headers;
  }

  /**
   * 更新会话Cookie
   */
  updateSessionCookies(sessionId: string, response: Response): void {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn('会话不存在，无法更新Cookie', { sessionId });
      return;
    }

    const newCookies = this.parseCookiesFromResponse(response);
    
    // 合并Cookie（新的覆盖旧的）
    const cookieMap = new Map<string, HttpCookie>();
    
    // 先添加现有Cookie
    session.cookies.forEach((cookie: any) => {
      cookieMap.set(`${cookie.name}:${cookie.domain || ''}:${cookie.path || '/'}`, cookie);
    });
    
    // 添加新Cookie
    newCookies.forEach((cookie: any) => {
      cookieMap.set(`${cookie.name}:${cookie.domain || ''}:${cookie.path || '/'}`, cookie);
    });
    
    session.cookies = Array.from(cookieMap.values());
    session.lastUsed = Date.now();
    
    logger.debug('会话Cookie已更新', {
      sessionId,
      newCookiesCount: newCookies.length,
      totalCookiesCount: session.cookies.length
    });
  }

  /**
   * 解析响应中的Cookie
   */
  private parseCookiesFromResponse(response: Response): HttpCookie[] {
    const cookies: HttpCookie[] = [];
    const setCookieHeaders = response.headers.get('set-cookie');
    
    if (!setCookieHeaders) {
      return cookies;
    }

    // 简单的Cookie解析（实际项目中可能需要更复杂的解析）
    const cookieStrings = setCookieHeaders.split(',');
    
    for (const cookieString of cookieStrings) {
      const parts = cookieString.trim().split(';');
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');
      
      if (name && value) {
        const cookie: HttpCookie = {
          name: name.trim(),
          value: value.trim()
        };
        
        // 解析其他属性
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i].trim().toLowerCase();
          if (part.startsWith('domain=')) {
            cookie.domain = part.substring(7);
          } else if (part.startsWith('path=')) {
            cookie.path = part.substring(5);
          } else if (part.startsWith('expires=')) {
            cookie.expires = new Date(part.substring(8)).getTime();
          } else if (part === 'httponly') {
            cookie.httpOnly = true;
          } else if (part === 'secure') {
            cookie.secure = true;
          } else if (part.startsWith('samesite=')) {
            cookie.sameSite = part.substring(9) as 'Strict' | 'Lax' | 'None';
          }
        }
        
        cookies.push(cookie);
      }
    }
    
    return cookies;
  }

  /**
   * 创建新会话
   */
  createNewSession(): string {
    const sessionId = this.generateSessionId();
    
    const sessionData: SessionData = {
      id: sessionId,
      cookies: [],
      headers: {},
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      lastUsed: Date.now()
    };

    this.sessions.set(sessionId, sessionData);
    
    logger.info('新会话已创建', { sessionId });
    
    return sessionId;
  }

  /**
   * 获取所有会话列表
   */
  getSessionList(): Array<{
    id: string;
    lastUsed: number;
    cookiesCount: number;
    age: number;
  }> {
    const now = Date.now();
    return Array.from(this.sessions.entries()).map(([id, session]: any) => ({
      id,
      lastUsed: session.lastUsed,
      cookiesCount: session.cookies.length,
      age: now - session.lastUsed
    }));
  }

  /**
   * 删除指定会话
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [id, session] of this.sessions) {
      if (now - session.lastUsed > this.sessionTimeout) {
        expired.push(id);
      }
    }
    
    for (const id of expired) {
      this.sessions.delete(id);
    }
    
    if (expired.length > 0) {
      logger.debug('清理过期会话', { count: expired.length });
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取会话统计
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    oldestSession: number | null;
    newestSession: number | null;
  } {
    const now = Date.now();
    let oldest: number | null = null;
    let newest: number | null = null;
    let active = 0;

    for (const session of this.sessions.values()) {
      if (now - session.lastUsed <= this.sessionTimeout) {
        active++;
      }
      
      if (oldest === null || session.lastUsed < oldest) {
        oldest = session.lastUsed;
      }
      
      if (newest === null || session.lastUsed > newest) {
        newest = session.lastUsed;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: active,
      oldestSession: oldest,
      newestSession: newest
    };
  }
}

// 导出单例实例
export const sessionCookieManager = new SessionCookieManager();