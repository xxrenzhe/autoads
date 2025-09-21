/**
 * 广告链接处理工具
 * 专门处理广告联盟链接的多层重定向和特殊需求
 */

// 广告链接配置
const AD_LINK_CONFIG = {
  patterns: [
    /bonusarrive\.com/,
    /fatcoupon\.com/,
    /linkbux\.com/,
    /shareasale\.com/,
    /redirect\.partner/,
    /yeahpromos\.com/,
    /\.track\//,
    /\/link\?/,
    /\/go\?/,
    /\/ref\//,
    /\/openurl\?/,
    /\/index\/openurl\?/,
  ],
  maxRedirects: 10,
  redirectWaitTime: 8000,
  redirectCheckInterval: 1000,
  finalPageStabilizeTime: 5000,
  timeout: 90000,
};

/**
 * 检测是否为广告链接
 */
export function isAdLink(url: string): boolean {
  return AD_LINK_CONFIG.patterns.some(pattern => pattern.test(url));
}

/**
 * 获取广告链接的HTTP请求配置
 */
export function getAdLinkRequestConfig(url: string) {
  if (!isAdLink(url)) {
    return null as any;
  }
  
  return {
    timeout: AD_LINK_CONFIG.timeout,
    maxRedirects: AD_LINK_CONFIG.maxRedirects,
    followRedirects: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  };
}

/**
 * 跟踪HTTP重定向链
 */
export async function followRedirectChain(url: string, options?: {
  maxRedirects?: number;
  timeout?: number;
  headers?: Record<string, string>;
}): Promise<{
  success: boolean;
  finalUrl?: string;
  redirectChain: string[];
  error?: string;
}> {
  const config = getAdLinkRequestConfig(url);
  const maxRedirects = options?.maxRedirects ?? config?.maxRedirects ?? 10;
  const timeout = options?.timeout ?? config?.timeout ?? 30000;
  const headers = { ...config?.headers, ...options?.headers };
  
  const redirectChain: string[] = [];
  let currentUrl = url;
  let redirectCount = 0;
  
  try {
    while (redirectCount < maxRedirects) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(currentUrl, {
          method: 'HEAD', // 使用HEAD请求减少数据传输
          headers,
          redirect: 'manual', // 手动处理重定向
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // 检查是否有重定向
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            // 处理相对URL
            const nextUrl = new URL(location, currentUrl).href;
            redirectChain.push(nextUrl);
            currentUrl = nextUrl;
            redirectCount++;
            continue;
          }
        }
        
        // 没有更多重定向，结束
        break;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            success: false,
            finalUrl: currentUrl,
            redirectChain,
            error: '请求超时',
          };
        }
        throw error;
      }
    }
    
    return {
      success: true,
      finalUrl: currentUrl,
      redirectChain,
    };
  } catch (error) {
    return {
      success: false,
      finalUrl: currentUrl,
      redirectChain,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 验证URL是否可访问
 */
export async function validateAdLinkAccess(url: string): Promise<{
  accessible: boolean;
  statusCode?: number;
  finalUrl?: string;
  error?: string;
}> {
  const config = getAdLinkRequestConfig(url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config?.timeout ?? 30000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: config?.headers ?? {},
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return {
      accessible: response.ok,
      statusCode: response.status,
      finalUrl: response.url,
    };
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 分析重定向链的有效性
 */
export function analyzeRedirectChain(redirectChain: string[]): {
  isValid: boolean;
  finalDestination?: string;
  issues: string[];
  confidence: number;
} {
  const issues: string[] = [];
  let confidence = 1.0;
  let finalDestination: string | undefined;
  
  if (redirectChain.length === 0) {
    return {
      isValid: true,
      confidence: 1.0,
      issues: [],
    };
  }
  
  const finalUrl = redirectChain[redirectChain.length - 1];
  
  // 检查重定向链长度
  if (redirectChain.length > AD_LINK_CONFIG.maxRedirects) {
    issues.push(`重定向链过长 (${redirectChain.length}层)`);
    confidence *= 0.7;
  }
  
  // 检查是否到达目标站点
  const targetPatterns = [
    /base44\.com/,
    /vheer\.com/,
    /daneey\.com/,
    /koalagp\.com/,
    /jescojes\.com/,
    // 可以添加更多目标站点模式
  ];
  
  const isTargetReached = targetPatterns.some(pattern => pattern.test(finalUrl));
  
  if (isTargetReached) {
    finalDestination = finalUrl;
    confidence *= 1.2; // 到达目标站点，增加置信度
  } else {
    issues.push('未检测到目标站点');
    confidence *= 0.8;
  }
  
  // 检查重定向链中的异常模式
  const hasRedirectLoop = redirectChain.some((url, index) => 
    redirectChain.slice(0, index).includes(url)
  );
  
  if (hasRedirectLoop) {
    issues.push('检测到重定向循环');
    confidence *= 0.5;
  }
  
  // 检查错误页面
  const errorPatterns = [
    /404/,
    /error/,
    /not-found/,
    /blocked/,
  ];
  
  const hasErrorPage = errorPatterns.some(pattern => pattern.test(finalUrl));
  
  if (hasErrorPage) {
    issues.push('最终页面为错误页面');
    confidence *= 0.3;
  }
  
  // 限制置信度范围
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    isValid: confidence > 0.6,
    finalDestination,
    issues,
    confidence,
  };
}

export default {
  isAdLink,
  getAdLinkRequestConfig,
  followRedirectChain,
  validateAdLinkAccess,
  analyzeRedirectChain,
};