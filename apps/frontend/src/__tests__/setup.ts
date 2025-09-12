// Vitest 测试设置文件
import { vi } from 'vitest';

// 模拟浏览器环境
global.fetch = vi.fn();
global.Request = vi.fn();
global.Response = vi.fn();

// 模拟 Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(() => ({
      newContext: vi.fn(() => ({
        newPage: vi.fn(() => ({
          setDefaultTimeout: vi.fn(),
          setExtraHTTPHeaders: vi.fn(),
          goto: vi.fn(),
          waitForLoadState: vi.fn(),
          screenshot: vi.fn(),
          close: vi.fn(),
          url: vi.fn(() => 'https://example.com'),
          mouse: { move: vi.fn() },
          evaluate: vi.fn(),
        })),
        addInitScript: vi.fn(),
        close: vi.fn(),
      })),
      close: vi.fn(),
    })),
  },
}));

// 模拟优化模块
vi.mock('@/lib/utils/advanced-optimization', () => ({
  createAdvancedOptimizer: vi.fn(() => ({
    generateBrowserContext: vi.fn(() => {
      // 模拟 70% 概率返回移动端 UA
      const isMobile = Math.random() < 0.7;
      if (isMobile) {
        return {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
          viewport: { width: 375, height: 812 },
          locale: 'en-US',
          timezone: 'America/Los_Angeles',
          extraHTTPHeaders: {},
          tlsConfig: { fingerprint: 'test-fingerprint' },
        };
      } else {
        return {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1920, height: 1080 },
          locale: 'en-US',
          timezone: 'America/Los_Angeles',
          extraHTTPHeaders: {},
          tlsConfig: { fingerprint: 'test-fingerprint' },
        };
      }
    }),
    generateTLSConfig: vi.fn(() => ({
      fingerprint: 'test-fingerprint',
      ciphers: [],
      extensions: [],
    })),
    generateNextVisitInterval: vi.fn((responseTime) => {
      // 模拟基于响应时间的间隔调整
      const baseInterval = 2000;
      const adaptationFactor = responseTime ? Math.min(responseTime / 1000, 3) : 1;
      return Math.round(baseInterval * (0.8 + adaptationFactor * 0.4));
    }),
    saveSessionState: vi.fn(),
    restoreSessionState: vi.fn(),
    clearProxySessions: vi.fn(),
    clearRoundSessions: vi.fn(),
  })),
}));

vi.mock('@/lib/utils/session-manager', () => {
  const sessions = new Map();
  
  return {
    sessionManager: {
      getSessionId: vi.fn((proxy, domain, round) => `${proxy}-${domain}-${round}`),
      saveSession: vi.fn((sessionId, sessionData) => {
        sessions.set(sessionId, sessionData);
      }),
      getSession: vi.fn((sessionId) => sessions.get(sessionId)),
      clearAllSessions: vi.fn(() => sessions.clear()),
      getActiveSessionCount: vi.fn(() => sessions.size),
      getTotalSessionCount: vi.fn(() => sessions.size),
    },
  };
});

vi.mock('@/lib/utils/geo-consistency', () => ({
  GeoConsistencyChecker: vi.fn().mockImplementation(() => ({
    generateConsistentConfig: vi.fn(() => ({
      timezone: 'America/Los_Angeles',
      locale: 'en-US',
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    })),
    validateConsistency: vi.fn(() => true),
  })),
}));

vi.mock('@/lib/utils/tls-fingerprint', () => ({
  getTLSConfig: vi.fn(() => ({
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    ciphers: [],
  })),
}));

vi.mock('@/lib/utils/visit-interval', () => ({
  VisitIntervalGenerator: vi.fn().mockImplementation(() => ({
    generateInterval: vi.fn((behavior, baseTime) => {
      // 使用正态分布生成随机间隔
      const mean = baseTime || 2000;
      const stdDev = mean * 0.3; // 30% 标准差
      // Box-Muller 变换生成正态分布随机数
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const interval = Math.max(500, Math.round(mean + z * stdDev));
      return interval;
    }),
  })),
}));

vi.mock('@/lib/visitors/simple-http-visitor', () => ({
  SimpleHttpVisitor: vi.fn().mockImplementation(() => ({
    visit: vi.fn(() => ({
      success: true,
      data: {},
      responseTime: 1000,
    })),
  })),
}));

vi.mock('@/lib/services/playwright-service', () => ({
  PlaywrightService: vi.fn().mockImplementation(() => ({
    visitUrl: vi.fn(() => ({
      success: true,
      responseTime: 2000,
    })),
  })),
}));