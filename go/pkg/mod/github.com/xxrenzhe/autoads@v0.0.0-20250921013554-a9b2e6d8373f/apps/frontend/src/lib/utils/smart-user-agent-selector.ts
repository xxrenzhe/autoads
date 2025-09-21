/**
 * 智能 User-Agent 选择器
 * 基于浏览器市场份额和平台分布进行智能选择
 */

import {
  ALL_USER_AGENTS,
  BROWSER_WEIGHTS,
  PLATFORM_WEIGHTS,
  MOBILE_PLATFORM_WEIGHTS,
  COMMON_VIEWPORTS,
  TOTAL_USER_AGENTS_COUNT
} from './user-agent-database';

export interface SelectedUserAgent {
  userAgent: string;
  browser: string;
  platform: 'desktop' | 'mobile';
  os?: string;
  viewport: { width: number; height: number };
}

/**
 * 根据权重随机选择选项
 */
function weightedRandomChoice<T>(options: { [key: string]: T }, weights: { [key: string]: number }): string {
  const totalWeight = Object.values(weights).reduce((sum, weight: any) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [key, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return key;
    }
  }
  
  return Object.keys(weights)[0];
}

/**
 * 智能选择 User-Agent
 */
export function getSmartUserAgent(options?: {
  preferMobile?: boolean;
  preferDesktop?: boolean;
  excludeBrowsers?: string[];
  includeOnlyBrowsers?: string[];
  platform?: 'desktop' | 'mobile' | 'any';
}): SelectedUserAgent {
  const {
    preferMobile = false,
    preferDesktop = false,
    excludeBrowsers = [],
    includeOnlyBrowsers,
    platform = 'any'
  } = options || {};

  // 移动端优先配置 - 70% 概率选择移动端
  let selectedPlatform: 'desktop' | 'mobile';
  if (platform === 'any' && !preferDesktop && !preferMobile) {
    selectedPlatform = Math.random() < 0.7 ? 'mobile' : 'desktop';
  } else if (platform === 'desktop' || preferDesktop) {
    selectedPlatform = 'desktop';
  } else if (platform === 'mobile' || preferMobile) {
    selectedPlatform = 'mobile';
  } else {
    // 根据平台权重随机选择
    selectedPlatform = weightedRandomChoice(
      { desktop: 'desktop', mobile: 'mobile' },
      PLATFORM_WEIGHTS
    ) as 'desktop' | 'mobile';
  }

  // 构建可用的浏览器列表
  let availableBrowsers: string[];
  if (includeOnlyBrowsers && includeOnlyBrowsers.length > 0) {
    availableBrowsers = includeOnlyBrowsers;
  } else {
    availableBrowsers = Object.keys(BROWSER_WEIGHTS).filter(
      browser => !excludeBrowsers.includes(browser)
    );
  }

  // 根据平台过滤浏览器
  if (selectedPlatform === 'mobile') {
    // 移动端可用的浏览器
    const mobileBrowsers = ['chromeMobile', 'chromeIOS', 'safari', 'samsung', 'uc'];
    availableBrowsers = availableBrowsers.filter((browser: any) => 
      mobileBrowsers.includes(browser) || 
      (browser === 'chrome' && Math.random() < 0.3) // 30% 概率使用桌面 Chrome 的移动版本
    );
  }

  // 根据权重选择浏览器
  const browserWeights: { [key: string]: number } = { ...BROWSER_WEIGHTS };
  
  // 调整权重以反映可用浏览器
  if (selectedPlatform === 'mobile') {
    // 移动端调整权重
    browserWeights.chrome = 0.4;  // Chrome Mobile
    browserWeights.chromeMobile = 0.25;
    browserWeights.chromeIOS = 0.15;
    browserWeights.safari = 0.1;
    browserWeights.samsung = 0.05;
    browserWeights.uc = 0.03;
    browserWeights.firefox = 0.02;
  }

  // 过滤掉不可用的浏览器权重
  const filteredWeights: { [key: string]: number } = {};
  let totalWeight = 0;
  for (const browser of availableBrowsers) {
    if (browserWeights[browser]) {
      filteredWeights[browser] = browserWeights[browser];
      totalWeight += browserWeights[browser];
    }
  }

  // 归一化权重
  for (const key in filteredWeights) {
    filteredWeights[key] = filteredWeights[key] / totalWeight;
  }

  const selectedBrowser = weightedRandomChoice(
  availableBrowsers.reduce((obj, key: any) => ({ ...obj, [key]: filteredWeights[key] || 0 }), {}), 
  filteredWeights
);

  // 获取该浏览器的 User-Agent 列表
  let userAgentList: string[] = [];
  if (selectedBrowser === 'chromeMobile' || selectedBrowser === 'chromeIOS') {
    userAgentList = (ALL_USER_AGENTS as any)[selectedBrowser];
  } else if (selectedBrowser === 'safari' && selectedPlatform === 'mobile') {
    // 移动端 Safari 通常是 iOS Safari
    userAgentList = ALL_USER_AGENTS.safari.filter((ua: any) => ua.includes('iPhone') || ua.includes('iPad'));
  } else {
    userAgentList = (ALL_USER_AGENTS as any)[selectedBrowser] || [];
  }

  // 如果没有找到合适的 User-Agent，回退到 Chrome
  if (userAgentList.length === 0) {
    userAgentList = ALL_USER_AGENTS.chrome;
  }

  // 随机选择一个 User-Agent
  const selectedUserAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];

  // 选择合适的视口
  let viewport: { width: number; height: number };
  if (selectedPlatform === 'mobile') {
    const mobileViewports = COMMON_VIEWPORTS.filter((v: any) => v.width < 768);
    viewport = mobileViewports[Math.floor(Math.random() * mobileViewports.length)];
  } else {
    const desktopViewports = COMMON_VIEWPORTS.filter((v: any) => v.width >= 1024);
    viewport = desktopViewports[Math.floor(Math.random() * desktopViewports.length)];
  }

  // 检测操作系统
  let os: string | undefined;
  if (selectedUserAgent.includes('Windows')) {
    os = 'Windows';
  } else if (selectedUserAgent.includes('Mac OS X') || selectedUserAgent.includes('macOS')) {
    os = 'macOS';
  } else if (selectedUserAgent.includes('Linux')) {
    os = 'Linux';
  } else if (selectedUserAgent.includes('Android')) {
    os = 'Android';
  } else if (selectedUserAgent.includes('iPhone OS') || selectedUserAgent.includes('CPU OS')) {
    os = 'iOS';
  } else if (selectedUserAgent.includes('CrOS')) {
    os = 'ChromeOS';
  }

  return {
    userAgent: selectedUserAgent,
    browser: selectedBrowser,
    platform: selectedPlatform,
    os,
    viewport
  };
}

/**
 * 获取多个不同的 User-Agent
 */
export function getMultipleUserAgents(count: number, options?: {
  ensureUnique?: boolean;
  ensureDifferentBrowsers?: boolean;
  ensurePlatformMix?: boolean;
}): SelectedUserAgent[] {
  const {
    ensureUnique = true,
    ensureDifferentBrowsers = false,
    ensurePlatformMix = false
  } = options || {};

  const agents: SelectedUserAgent[] = [];
  const usedBrowsers = new Set<string>();
  const usedPlatforms = new Set<string>();

  for (let i = 0; i < count; i++) {
    let agent: SelectedUserAgent;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      // 根据已选择的平台调整选项
      const currentOptions: Parameters<typeof getSmartUserAgent>[0] = {};
      
      if (ensurePlatformMix && agents.length > 0) {
        const missingPlatforms = ['desktop', 'mobile'].filter((p: any) => !usedPlatforms.has(p));
        if (missingPlatforms.length > 0) {
          currentOptions.platform = missingPlatforms[0] as 'desktop' | 'mobile';
        }
      }

      if (ensureDifferentBrowsers && agents.length > 0) {
        const availableBrowsers = Object.keys(BROWSER_WEIGHTS).filter((b: any) => !usedBrowsers.has(b));
        if (availableBrowsers.length > 0) {
          currentOptions.includeOnlyBrowsers = availableBrowsers;
        }
      }

      agent = getSmartUserAgent(currentOptions);
      attempts++;
    } while (
      ensureUnique && 
      agents.some(a => a.userAgent === agent.userAgent) && 
      attempts < maxAttempts
    );

    agents.push(agent);
    usedBrowsers.add(agent.browser);
    usedPlatforms.add(agent.platform);
  }

  return agents;
}

/**
 * 获取指定浏览器的 User-Agent
 */
export function getUserAgentByBrowser(browser: string): SelectedUserAgent | null {
  const userAgentList = ALL_USER_AGENTS[browser as keyof typeof ALL_USER_AGENTS];
  if (!userAgentList || userAgentList.length === 0) {
    return null as any;
  }

  const userAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];
  
  // 确定平台
  let platform: 'desktop' | 'mobile';
  if (browser === 'chromeMobile' || browser === 'chromeIOS' || 
      browser === 'samsung' || browser === 'uc' ||
      (browser === 'safari' && (userAgent.includes('iPhone') || userAgent.includes('iPad')))) {
    platform = 'mobile';
  } else {
    platform = 'desktop';
  }

  // 选择合适的视口
  const viewports = COMMON_VIEWPORTS.filter((v: any) => 
    platform === 'mobile' ? v.width < 768 : v.width >= 1024
  );
  const viewport = viewports[Math.floor(Math.random() * viewports.length)];

  return {
    userAgent,
    browser,
    platform,
    viewport
  };
}

/**
 * 获取所有支持的浏览器列表
 */
export function getSupportedBrowsers(): string[] {
  return Object.keys(ALL_USER_AGENTS);
}

/**
 * 获取 User-Agent 统计信息
 */
export function getUserAgentStats() {
  const stats = {
    totalUserAgents: TOTAL_USER_AGENTS_COUNT,
    browserCounts: {} as { [key: string]: number },
    platformCounts: {
      desktop: 0,
      mobile: 0
    }
  };

  for (const [browser, agents] of Object.entries(ALL_USER_AGENTS)) {
    stats.browserCounts[browser] = agents.length;
    
    // 计算平台分布
    if (['chromeMobile', 'chromeIOS', 'samsung', 'uc'].includes(browser)) {
      stats.platformCounts.mobile += agents.length;
    } else if (browser === 'safari') {
      // Safari 可能在桌面或移动端
      const mobileCount = agents.filter((ua: any) => ua.includes('iPhone') || ua.includes('iPad')).length;
      stats.platformCounts.mobile += mobileCount;
      stats.platformCounts.desktop += agents.length - mobileCount;
    } else {
      stats.platformCounts.desktop += agents.length;
    }
  }

  return stats;
}