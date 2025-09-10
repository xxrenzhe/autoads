/**
 * 访问间隔随机化工具
 * 使用正态分布和人类行为模式生成更自然的访问间隔
 */

export interface VisitIntervalOptions {
  // 基础配置
  baseInterval?: number; // 基础间隔时间（毫秒）
  minInterval?: number; // 最小间隔时间
  maxInterval?: number; // 最大间隔时间
  
  // 随机化配置
  randomizationType?: 'uniform' | 'normal' | 'exponential' | 'human';
  standardDeviation?: number; // 标准差（用于正态分布）
  
  // 人类行为模式
  humanPattern?: 'reading' | 'browsing' | 'shopping' | 'working';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // 动态调整
  adaptive?: boolean; // 是否根据响应时间自适应调整
  responseTimeFactor?: number; // 响应时间影响因子
}

export interface IntervalPattern {
  name: string;
  description: string;
  generate: () => number;
}

/**
 * 访问间隔生成器
 */
export class VisitIntervalGenerator {
  private options: Required<VisitIntervalOptions>;
  private lastResponseTime: number = 0;
  private consecutiveVisits: number = 0;
  
  constructor(options: VisitIntervalOptions = {}) {
    this.options = {
      baseInterval: options.baseInterval || 5000,
      minInterval: options.minInterval || 1000,
      maxInterval: options.maxInterval || 30000,
      randomizationType: options.randomizationType || 'human',
      standardDeviation: options.standardDeviation || 2000,
      humanPattern: options.humanPattern || 'browsing',
      timeOfDay: options.timeOfDay || 'afternoon',
      adaptive: options.adaptive || false,
      responseTimeFactor: options.responseTimeFactor || 0.5
    };
  }
  
  /**
   * 生成下一个访问间隔
   */
  generateNextInterval(responseTime?: number): number {
    if (responseTime) {
      this.lastResponseTime = responseTime;
    }
    
    this.consecutiveVisits++;
    
    let interval: number;
    
    switch (this.options.randomizationType) {
      case 'uniform':
        interval = this.generateUniformInterval();
        break;
      case 'normal':
        interval = this.generateNormalInterval();
        break;
      case 'exponential':
        interval = this.generateExponentialInterval();
        break;
      case 'human':
      default:
        interval = this.generateHumanInterval();
        break;
    }
    
    // 自适应调整
    if (this.options.adaptive && this.lastResponseTime > 0) {
      interval = this.applyAdaptiveAdjustment(interval);
    }
    
    // 确保在范围内
    interval = Math.max(this.options.minInterval, Math.min(this.options.maxInterval, interval));
    
    // 重置计数器
    if (interval > 10000) {
      this.consecutiveVisits = 0;
    }
    
    return interval;
  }
  
  /**
   * 均匀分布随机间隔
   */
  private generateUniformInterval(): number {
    const range = this.options.baseInterval * 0.5;
    return this.options.baseInterval + (Math.random() - 0.5) * range;
  }
  
  /**
   * 正态分布随机间隔（Box-Muller变换）
   */
  private generateNormalInterval(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const interval = this.options.baseInterval + z * this.options.standardDeviation;
    
    return interval;
  }
  
  /**
   * 指数分布随机间隔
   */
  private generateExponentialInterval(): number {
    const lambda = 1 / this.options.baseInterval;
    return -Math.log(1 - Math.random()) / lambda;
  }
  
  /**
   * 基于人类行为模式的间隔生成
   */
  private generateHumanInterval(): number {
    const pattern = this.getHumanPattern();
    const timeMultiplier = this.getTimeOfDayMultiplier();
    
    let baseInterval = this.options.baseInterval;
    
    // 应用模式调整
    switch (pattern) {
      case 'reading':
        // 阅读模式：较长且变化的间隔
        baseInterval *= (1.5 + Math.random() * 1.5);
        break;
      case 'browsing':
        // 浏览模式：中等长度间隔
        baseInterval *= (0.8 + Math.random() * 0.8);
        break;
      case 'shopping':
        // 购物模式：短间隔，偶有长间隔（比较商品）
        if (Math.random() < 0.2) {
          baseInterval *= (3 + Math.random() * 2);
        } else {
          baseInterval *= (0.5 + Math.random() * 0.5);
        }
        break;
      case 'working':
        // 工作模式：规律但有变化的间隔
        baseInterval *= (0.9 + Math.random() * 0.4);
        break;
    }
    
    // 应用时间调整
    baseInterval *= timeMultiplier;
    
    // 添加一些随机噪声
    const noise = 0.8 + Math.random() * 0.4;
    baseInterval *= noise;
    
    // 连续访问时的疲劳因子
    if (this.consecutiveVisits > 3) {
      const fatigue = Math.min(this.consecutiveVisits * 0.1, 0.5);
      baseInterval *= (1 + fatigue);
    }
    
    return baseInterval;
  }
  
  /**
   * 获取人类行为模式配置
   */
  private getHumanPattern(): string {
    // 根据连续访问次数动态调整模式
    if (this.consecutiveVisits > 10) {
      // 长时间连续访问，可能是工作模式
      return 'working';
    } else if (this.consecutiveVisits > 5) {
      // 中等时间连续访问，可能是浏览模式
      return 'browsing';
    }
    
    return this.options.humanPattern;
  }
  
  /**
   * 获取时间倍数
   */
  private getTimeOfDayMultiplier(): number {
    const multipliers: Record<string, number> = {
      morning: 1.2,      // 早晨访问较慢
      afternoon: 1.0,    // 下午正常
      evening: 0.8,      // 晚上较快
      night: 1.5        // 深夜很慢
    };
    
    return multipliers[this.options.timeOfDay] || 1.0;
  }
  
  /**
   * 自适应调整
   */
  private applyAdaptiveAdjustment(interval: number): number {
    // 根据上次响应时间调整
    const adjustment = this.lastResponseTime * this.options.responseTimeFactor;
    return interval + adjustment;
  }
  
  /**
   * 重置生成器状态
   */
  reset(): void {
    this.lastResponseTime = 0;
    this.consecutiveVisits = 0;
  }
  
  /**
   * 更新配置
   */
  updateOptions(options: Partial<VisitIntervalOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * 批量访问间隔生成器
 */
export class BatchIntervalGenerator {
  private generators: VisitIntervalGenerator[] = [];
  
  /**
   * 为多个并发任务生成间隔序列
   */
  generateIntervalSequence(
    count: number,
    options?: VisitIntervalOptions
  ): number[] {
    const generator = new VisitIntervalGenerator(options);
    const intervals: number[] = [];
    
    for (let i = 0; i < count; i++) {
      intervals.push(generator.generateNextInterval());
    }
    
    return intervals;
  }
  
  /**
   * 生成错开的访问间隔（用于并发访问）
   */
  generateStaggeredIntervals(
    concurrency: number,
    baseInterval: number,
    staggerRatio: number = 0.3
  ): number[] {
    const intervals: number[] = [];
    
    for (let i = 0; i < concurrency; i++) {
      const stagger = i * baseInterval * staggerRatio;
      intervals.push(stagger);
    }
    
    return intervals;
  }
}

/**
 * 预定义的访问间隔模式
 */
export const INTERVAL_PATTERNS: Record<string, IntervalPattern> = {
  quickBrowse: {
    name: '快速浏览',
    description: '2-5秒间隔，适合快速浏览',
    generate: () => 2000 + Math.random() * 3000
  },
  
  normalRead: {
    name: '正常阅读',
    description: '5-15秒间隔，模拟阅读时间',
    generate: () => 5000 + Math.random() * 10000
  },
  
  deepRead: {
    name: '深度阅读',
    description: '10-30秒间隔，深度阅读长文',
    generate: () => 10000 + Math.random() * 20000
  },
  
  comparison: {
    name: '商品比较',
    description: '短间隔穿插长间隔，模拟比较商品',
    generate: () => Math.random() < 0.3 ? 15000 + Math.random() * 15000 : 2000 + Math.random() * 3000
  },
  
  working: {
    name: '工作模式',
    description: '规律的间隔，模拟工作时的访问',
    generate: () => {
      const base = 8000;
      const variation = base * 0.2;
      return base + (Math.random() - 0.5) * variation;
    }
  }
};

// 导出便捷函数
export function generateVisitInterval(options?: VisitIntervalOptions): number {
  const generator = new VisitIntervalGenerator(options);
  return generator.generateNextInterval();
}