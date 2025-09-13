/**
 * Silent Version Proxy Utilities
 * 静默版本专用代理工具，实现特定的代理获取和管理逻辑
 */

import { createClientLogger } from './security/client-secure-logger';
import { EnhancedError } from '@/lib/utils/error-handling';

const logger = createClientLogger('SilentProxyUtils');

/**
 * 计算所需代理IP数量
 * 根据用户输入的URL数量和"每个URL打开次数"，计算需要的代理IP数量
 * 确保"每个URL的每次请求都使用唯一的代理IP"，同时尽量减少所需的代理IP数量
 * 
 * 计算规则：
 * - 每个访问轮次需要一个唯一代理IP
 * - 不同URL可以复用相同代理IP
 * - 最终所需代理数量 = max(每个URL的访问次数)
 * 
 * @param urlCount URL数量
 * @param visitsPerUrl 每个URL的访问次数数组
 * @returns 计算出的代理IP数量
 */
export function calculateRequiredProxyCount(urlCount: number, visitsPerUrl: number[]): number {
  try {
    // 参数验证
    if (!Array.isArray(visitsPerUrl) || visitsPerUrl.length === 0) {
      logger.warn('visitsPerUrl参数无效', { urlCount, visitsPerUrl });
      return urlCount; // 降级到每个URL一个代理
    }
    
    if (visitsPerUrl.length !== urlCount) {
      logger.warn('visitsPerUrl长度与urlCount不匹配', { 
        urlCount, 
        visitsPerUrlLength: visitsPerUrl.length,
        visitsPerUrl 
      });
      // 使用实际长度
      const actualVisitsPerUrl = visitsPerUrl.slice(0, urlCount);
      return calculateRequiredProxyCount(urlCount, actualVisitsPerUrl);
    }
    
    // 计算逻辑：确保"每个URL的每次请求都使用唯一的代理IP"
    // - 同一URL的不同访问必须使用不同代理
    // - 不同URL的相同访问轮次可以复用相同代理
    // - 最终所需代理数量 = max(每个URL的访问次数)
    // 
    // 示例：7个URL，每个5次访问 → 需要5个代理
    // - 轮次1：所有URL使用代理1
    // - 轮次2：所有URL使用代理2  
    // - 轮次3：所有URL使用代理3
    // - 轮次4：所有URL使用代理4
    // - 轮次5：所有URL使用代理5
    const maxVisits = Math.max(...visitsPerUrl);
    const requiredProxyCount = maxVisits;
    
    logger.info('代理数量计算完成', {
      urlCount,
      visitsPerUrl,
      maxVisits,
      requiredProxyCount,
      calculationRule: 'max(visitsPerUrl) - 确保每个请求唯一代理',
      description: `${urlCount}个URL × 访问次数[${visitsPerUrl.join(',')}] → 需要${requiredProxyCount}个代理IP（轮次复用策略）`
    });
    
    return requiredProxyCount;
    
  } catch (error) {
    logger.error('代理数量计算异常', new EnhancedError('代理数量计算异常', {
      error: error instanceof Error ? error.message : String(error),
      urlCount,
      visitsPerUrl
    }));
    
    // 降级到简单计算：每个URL一个代理
    return urlCount;
  }
}

/**
 * 计算实际总访问次数
 * 基于每个URL的访问次数计算总访问次数
 */
export function calculateTotalVisits(visitsPerUrl: number[]): number {
  try {
    if (!Array.isArray(visitsPerUrl) || visitsPerUrl.length === 0) {
      return 0;
    }
    
    const totalVisits = visitsPerUrl.reduce((sum, visits: any) => sum + visits, 0);
    
    logger.debug('总访问次数计算', {
      visitsPerUrl,
      totalVisits,
      formula: 'sum(visitsPerUrl)'
    });
    
    return totalVisits;
    
  } catch (error) {
    logger.error('总访问次数计算异常', new EnhancedError('总访问次数计算异常', {
      error: error instanceof Error ? error.message : String(error),
      visitsPerUrl
    }));
    
    return 0;
  }
}

/**
 * 验证代理数量配置的合理性
 */
export function validateProxyCountConfiguration(
  urlCount: number, 
  visitsPerUrl: number[], 
  availableProxies: number
): {
  isValid: boolean;
  required: number;
  available: number;
  shortage: number;
  satisfaction: number;
  recommendations: string[];
} {
  const required = calculateRequiredProxyCount(urlCount, visitsPerUrl);
  const shortage = Math.max(0, required - availableProxies);
  const satisfaction = availableProxies >= required ? 100 : Math.round((availableProxies / required) * 100);
  
  const recommendations: string[] = [];
  
  if (satisfaction < 100) {
    recommendations.push('代理数量不足，无法进入批量访问阶段');
  }
  
  if (required > 50) {
    recommendations.push('代理需求数量较大，建议分批执行任务');
  }
  
  if (urlCount > 100) {
    recommendations.push('URL数量较多，建议分批处理以提高稳定性');
  }
  
  return {
    isValid: satisfaction >= 100, // 必须100%满足率才认为配置合理
    required,
    available: availableProxies,
    shortage,
    satisfaction,
    recommendations
  };
}

/**
 * 生成代理分配策略
 * 为每个URL的每次访问分配代理IP，确保唯一性
 */
export function generateProxyAllocationStrategy(
  urlCount: number, 
  visitsPerUrl: number[], 
  availableProxies: number
): {
  strategy: 'optimal' | 'compromise' | 'insufficient';
  allocation: Map<string, number[]>; // URL -> 代理索引数组
  utilization: number;
  proxyReusage: number;
} {
  const required = calculateRequiredProxyCount(urlCount, visitsPerUrl);
  const allocation = new Map<string, number[]>();
  
  // 初始化分配映射
  for (let i = 0; i < urlCount; i++) {
    allocation.set(`url_${i}`, []);
  }
  
  if (availableProxies >= required) {
    // 最优情况：代理充足
    let proxyIndex = 0;
    for (let i = 0; i < urlCount; i++) {
      const urlKey = `url_${i}`;
      const visits = visitsPerUrl[i];
      
      // 为每个访问分配不同代理
      for (let j = 0; j < visits; j++) {
        allocation.get(urlKey)!.push(proxyIndex % availableProxies);
        proxyIndex++;
      }
    }
    
    return {
      strategy: 'optimal',
      allocation,
      utilization: Math.round((required / availableProxies) * 100),
      proxyReusage: 0
    };
  } else {
    // 代理不足情况：需要复用代理
    const proxyReusage = required - availableProxies;
    
    // 轮询分配代理，尽量均匀复用
    for (let i = 0; i < urlCount; i++) {
      const urlKey = `url_${i}`;
      const visits = visitsPerUrl[i];
      
      for (let j = 0; j < visits; j++) {
        const proxyIndex = j % availableProxies;
        allocation.get(urlKey)!.push(proxyIndex);
      }
    }
    
    return {
      strategy: availableProxies >= required * 0.7 ? 'compromise' : 'insufficient',
      allocation,
      utilization: 100,
      proxyReusage
    };
  }
}

/**
 * 计算代理获取进度百分比
 * 用于前端显示代理获取阶段的进度
 */
export function calculateProxyAcquisitionProgress(
  phase: 'validation' | 'redis_check' | 'batch_fetch' | 'individual_fetch' | 'completion',
  currentStep: number,
  totalSteps: number,
  baseProgress: number = 20,
  maxProgress: number = 40
): number {
  const phaseProgress = (currentStep / totalSteps) * 100;
  const progressRange = maxProgress - baseProgress;
  return Math.min(maxProgress, baseProgress + Math.round((phaseProgress / 100) * progressRange));
}

/**
 * 代理获取阶段配置
 */
export const PROXY_ACQUISITION_PHASES = {
  VALIDATION: { progress: 20, message: '代理验证中...' },
  REDIS_CHECK: { progress: 25, message: '检查Redis缓存...' },
  BATCH_FETCH: { progress: 30, message: '批量获取代理IP...' },
  INDIVIDUAL_FETCH: { progress: 35, message: '单独获取补充...' },
  COMPLETION: { progress: 40, message: '代理获取完成' }
} as const;

/**
 * 检查是否需要触发代理补充
 * 当Redis代理数量低于阈值时触发补充
 */
export function shouldTriggerProxySupplement(
  redisProxyCount: number, 
  threshold: number = 10,
  currentTaskDemand: number = 0
): {
  shouldSupplement: boolean;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendedCount: number;
} {
  const totalDemand = Math.max(currentTaskDemand, threshold);
  const shortage = Math.max(0, totalDemand - redisProxyCount);
  
  if (redisProxyCount <= 0) {
    return {
      shouldSupplement: true,
      reason: 'Redis代理已耗尽',
      priority: 'critical',
      recommendedCount: Math.max(20, totalDemand * 2)
    };
  }
  
  if (redisProxyCount < 5) {
    return {
      shouldSupplement: true,
      reason: `Redis代理数量过低 (${redisProxyCount} < 5)`,
      priority: 'high',
      recommendedCount: Math.max(15, totalDemand * 1.5)
    };
  }
  
  if (redisProxyCount < threshold) {
    return {
      shouldSupplement: true,
      reason: `Redis代理数量低于阈值 (${redisProxyCount} < ${threshold})`,
      priority: 'medium',
      recommendedCount: Math.max(10, totalDemand)
    };
  }
  
  if (currentTaskDemand > 0 && redisProxyCount < currentTaskDemand) {
    return {
      shouldSupplement: true,
      reason: `当前任务需求不足 (${redisProxyCount} < ${currentTaskDemand})`,
      priority: 'high',
      recommendedCount: Math.max(currentTaskDemand * 1.2, threshold * 2)
    };
  }
  
  return {
    shouldSupplement: false,
    reason: 'Redis代理数量充足',
    priority: 'low',
    recommendedCount: 0
  };
}