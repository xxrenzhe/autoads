import { NextRequest, NextResponse } from 'next/server';
import { simpleMonitor } from './simple-monitor';
import { withSimpleMonitoring } from './simple-monitor';

// 为核心功能创建便捷的监控中间件
export function withFeatureMonitoring(
  feature: 'siterank' | 'batchopen' | 'adscenter',
  handler: (req: NextRequest, userId?: string) => Promise<NextResponse>
) {
  return withSimpleMonitoring(handler, {
    feature,
    extractTokens: (response: NextResponse) => {
      // 尝试从响应中提取token消耗
      try {
        const data = response.clone().json();
        if (data instanceof Promise) {
          // 如果是Promise，我们无法在这里同步获取
          return 0;
        }
        return (data as any).tokensUsed || 0;
      } catch {
        return 0;
      }
    }
  });
}

// 记录Token消耗的便捷方法
export function recordTokenConsumption(
  userId: string,
  amount: number,
  feature: 'siterank' | 'batchopen' | 'adscenter',
  endpoint: string
) {
  simpleMonitor.recordTokenConsumption(userId, amount, feature, endpoint);
}