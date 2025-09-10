/**
 * 会话管理器
 * 管理每个代理IP的会话状态，提高访问真实性
 */

export interface HttpCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface SessionData {
  cookies: HttpCookie[];
  headers: Record<string, string>;
  userAgent: string;
  createdAt: Date;
  lastUsed: Date;
  domain: string;
}

export interface ProxySession {
  proxy: string;
  domain: string;
  round: number;
  session: SessionData;
}

export class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, ProxySession>();
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    // 每30分钟清理一次过期会话
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 30 * 60 * 1000);
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * 获取或创建会话
   */
  async getOrCreateSession(
    proxy: string,
    domain: string,
    round: number,
    options?: {
      userAgent?: string;
    }
  ): Promise<ProxySession> {
    const key = `${proxy}_${domain}_${round}`;
    
    // 检查是否已有会话
    if (this.sessions.has(key)) {
      const session = this.sessions.get(key)!;
      session.session.lastUsed = new Date();
      return session;
    }

    // 创建新会话
    const session: ProxySession = {
      proxy,
      domain,
      round,
      session: {
        cookies: [],
        headers: {},
        userAgent: options?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        createdAt: new Date(),
        lastUsed: new Date(),
        domain
      }
    };

    this.sessions.set(key, session);
    return session;
  }

  /**
   * 保存HTTP响应状态到会话
   */
  async saveResponseState(response: Response, session: ProxySession): Promise<void> {
    // 解析并保存 cookies
    const cookies = this.parseCookiesFromResponse(response);
    if (cookies.length > 0) {
      session.session.cookies = cookies;
    }

    // 保存相关头信息
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('auth') || 
          key.toLowerCase().includes('session') ||
          key.toLowerCase().includes('csrf') ||
          key.toLowerCase().includes('token')) {
        headers[key] = value;
      }
    });
    
    if (Object.keys(headers).length > 0) {
      session.session.headers = { ...session.session.headers, ...headers };
    }

    // 更新最后使用时间
    session.session.lastUsed = new Date();
  }

  /**
   * 获取会话的HTTP请求头
   */
  getSessionRequestHeaders(session: ProxySession): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': session.session.userAgent,
      ...session.session.headers
    };

    // 添加Cookie头
    if (session.session.cookies.length > 0) {
      headers['Cookie'] = session.session.cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
    }

    return headers;
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
          }
        }
        
        cookies.push(cookie);
      }
    }
    
    return cookies;
  }

  /**
   * 清理指定代理的所有会话
   */
  clearProxySessions(proxy: string): void {
    const keysToDelete: string[] = [];
    
    this.sessions.forEach((session, key) => {
      if (session.proxy === proxy) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.sessions.delete(key));
  }

  /**
   * 清理指定轮次的会话
   */
  clearRoundSessions(round: number): void {
    const keysToDelete: string[] = [];
    
    this.sessions.forEach((session, key) => {
      if (session.round === round) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.sessions.delete(key));
  }

  /**
   * 清理过期会话（超过2小时未使用）
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expireTime = 2 * 60 * 60 * 1000; // 2小时
    const keysToDelete: string[] = [];

    this.sessions.forEach((session, key) => {
      const lastUsed = session.session.lastUsed.getTime();
      if (now - lastUsed > expireTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.sessions.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired sessions`);
    }
  }

  /**
   * 获取会话统计信息
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    proxyDistribution: Record<string, number>;
    domainDistribution: Record<string, number>;
  } {
    const stats = {
      totalSessions: this.sessions.size,
      activeSessions: 0,
      proxyDistribution: {} as Record<string, number>,
      domainDistribution: {} as Record<string, number>
    };

    const now = Date.now();
    const activeThreshold = 30 * 60 * 1000; // 30分钟内活跃

    this.sessions.forEach(session => {
      const lastUsed = session.session.lastUsed.getTime();
      if (now - lastUsed < activeThreshold) {
        stats.activeSessions++;
      }

      // 统计代理分布
      stats.proxyDistribution[session.proxy] = 
        (stats.proxyDistribution[session.proxy] || 0) + 1;

      // 统计域名分布
      stats.domainDistribution[session.domain] = 
        (stats.domainDistribution[session.domain] || 0) + 1;
    });

    return stats;
  }

  /**
   * 销毁会话管理器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }

  /**
   * 清理所有会话
   */
  clearAllSessions(): void {
    this.sessions.clear();
  }

  /**
   * 获取活跃会话数量
   */
  getActiveSessionCount(): number {
    const now = Date.now();
    const activeThreshold = 30 * 60 * 1000; // 30分钟内活跃
    let activeCount = 0;
    
    this.sessions.forEach(session => {
      const lastUsed = session.session.lastUsed.getTime();
      if (now - lastUsed < activeThreshold) {
        activeCount++;
      }
    });
    
    return activeCount;
  }

  /**
   * 获取总会话数量
   */
  getTotalSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 简化的会话保存方法（用于测试）
   */
  saveSession(sessionId: string, sessionData: any): void {
    // 这里只是简单存储，不保存完整的会话数据
    this.sessions.set(sessionId, {
      proxy: sessionId.split('-')[0] || 'unknown',
      domain: sessionId.split('-')[1] || 'unknown',
      round: parseInt(sessionId.split('-')[2] || '1'),
      session: {
        ...sessionData,
        createdAt: new Date(),
        lastUsed: new Date()
      } as SessionData
    });
  }

  /**
   * 简化的会话获取方法（用于测试）
   */
  getSession(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (session) {
      return {
        cookies: session.session.cookies,
        headers: session.session.headers,
        timestamp: session.session.lastUsed.getTime()
      };
    }
    return undefined;
  }
}

// 导出单例实例
export const sessionManager = SessionManager.getInstance();