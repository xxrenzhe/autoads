/**
 * 广告数量计算器
 * 提供广告数量分析和计算功能
 */
export class AdCountCalculator {
  constructor() {
    console.log('AdCountCalculator initialized');
  }

  /**
   * 计算建议的打开次数
   */
  calculateRecommendedOpenCount(options: { totalAds: number;
    adsPerOpen: number;
    minOpenCount: number;
    maxOpenCount: number }): {
    recommendedCount: number;
    reason: string;
  } {
    const { totalAds, adsPerOpen, minOpenCount, maxOpenCount } = options;
    
    // 基础计算
    let recommendedCount = Math.ceil(totalAds / adsPerOpen);
    
    // 应用限制
    recommendedCount = Math.max(minOpenCount, Math.min(maxOpenCount, recommendedCount));
    
    const reason = `基于 ${totalAds} 个活跃广告，按每 ${adsPerOpen} 个广告需要 1 次打开计算`;
    
    return {
      recommendedCount,
      reason
    };
  }

  /**
   * 分析广告分布
   */
  analyzeAdDistribution(ads: any[]): {
    totalAds: number;
    activeAds: number;
    distribution: Record<string, number>;
  } {
    const totalAds = ads.length;
    const activeAds = ads.filter(ad => ad.status === 'active').length;
    
    const distribution: Record<string, number> = {};
    ads.forEach(ad => { 
      const status = ad.status || 'unknown';
      distribution[status] = (distribution[status] || 0) + 1;
    });
    return {
      totalAds,
      activeAds,
      distribution
    };
  }

  /**
   * 计算最优配置
   */
  calculateOptimalConfiguration(totalAds: number): {
    adsPerOpen: number;
    estimatedOpenCount: number;
    efficiency: number;
  } {
    // 简单的最优化算法
    const adsPerOpen = Math.max(1, Math.min(10, Math.ceil(totalAds / 20)));
    const estimatedOpenCount = Math.ceil(totalAds / adsPerOpen);
    const efficiency = (totalAds / estimatedOpenCount) / 10; // 效率评分 0-1
    
    return {
      adsPerOpen,
      estimatedOpenCount,
      efficiency: Math.min(1, efficiency)
    };
  }

  /**
   * 验证计算参数
   */
  validateCalculationOptions(options: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!options.totalAds || options.totalAds <= 0) {
      errors.push('总广告数必须大于0');
    }
    
    if (!options.adsPerOpen || options.adsPerOpen <= 0) {
      errors.push('每次打开广告数必须大于0');
    }
    
    if (options.minOpenCount < 0) {
      errors.push('最小打开次数不能小于0');
    }
    
    if (options.maxOpenCount <= options.minOpenCount) {
      errors.push('最大打开次数必须大于最小打开次数');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AdCountCalculator; 