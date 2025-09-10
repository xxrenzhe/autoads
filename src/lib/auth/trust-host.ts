/**
 * NextAuth v5 Trust Host Configuration
 * 处理 ClawCloud 部署环境中的动态主机名信任问题
 * 
 * 注意：NextAuth v5 的 trustHost 只接受 boolean 值
 * 主机验证逻辑通过环境变量和部署配置处理
 */

/**
 * 检查主机是否应该被信任
 * 这个函数用于调试和验证，不直接用于 NextAuth 配置
 */
export function isHostTrusted(host: string): boolean {
  console.log(`[NextAuth] Checking trust for host: ${host}`);
  
  // ClawCloud 内部域名模式
  const clawCloudPatterns = [
    /^autoads-preview-[a-f0-9]+-[a-z0-9]+:3000$/,
    /^autoads-prod-[a-f0-9]+-[a-z0-9]+:3000$/,
    /^autoads-preview-[a-f0-9]+-[a-z0-9]+$/,
    /^autoads-prod-[a-f0-9]+-[a-z0-9]+$/
  ];

  // 检查是否匹配 ClawCloud 模式
  for (const pattern of clawCloudPatterns) {
    if (pattern.test(host)) {
      console.log(`[NextAuth] Trusted ClawCloud host: ${host}`);
      return true;
    }
  }

  // 预定义的受信任域名
  const trustedDomains = [
    'localhost:3000',
    'localhost',
    'urlchecker.dev',
    'www.urlchecker.dev',
    'autoads.dev',
    'www.autoads.dev'
  ];

  // 检查是否为受信任的域名
  const isTrusted = trustedDomains.some(domain => {
    return host === domain || host.endsWith(`.${domain}`);
  });

  if (isTrusted) {
    console.log(`[NextAuth] Trusted configured host: ${host}`);
    return true;
  }

  // 环境变量中的额外信任主机
  const extraTrustedHosts = process.env.AUTH_TRUSTED_HOSTS?.split(',') || [];
  for (const trustedHost of extraTrustedHosts) {
    if (host === trustedHost.trim()) {
      console.log(`[NextAuth] Trusted environment host: ${host}`);
      return true;
    }
  }

  console.warn(`[NextAuth] Untrusted host rejected: ${host}`);
  return false;
}

/**
 * NextAuth v5 信任主机配置
 * 在生产环境中总是返回 true，依赖环境配置和反向代理进行安全控制
 */
export function createTrustHostConfig(): boolean {
  // 在开发环境中，信任所有主机
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // 在生产环境中，NextAuth v5 要求 trustHost 为 boolean
  // 安全性通过以下方式保证：
  // 1. 环境变量 AUTH_TRUST_HOST 控制
  // 2. ClawCloud 反向代理和网络隔离
  // 3. 环境注入脚本动态配置受信任主机
  return process.env.AUTH_TRUST_HOST === 'true';
}

/**
 * 获取当前环境的 AUTH_URL
 */
export function getAuthUrl(): string {
  // 优先使用环境变量
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL;
  }

  // 开发环境默认值
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  // 根据部署环境确定 URL
  const deploymentEnv = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV;
  
  if (deploymentEnv === 'preview') {
    return 'https://www.urlchecker.dev';
  } else if (deploymentEnv === 'production') {
    return 'https://www.autoads.dev';
  }

  // 回退到基础 URL
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}