/**
 * Node.js 垃圾回收优化工具
 * 提供智能GC调度和内存管理
 */

import { createMemoryLogger } from "@/lib/utils/memory-logger";

const logger = createMemoryLogger('GCOptimizer');

// 从环境变量读取GC配置
const getGCConfig = () => {
  return {
    // GC触发阈值
    THRESHOLDS: {
      // 基于堆使用率的阈值 - 修复频繁GC问题
      HEAP_USED_PERCENT: {
        CONSERVATIVE: parseFloat(process.env.GC_CONSERVATIVE_THRESHOLD || '0.85'),
        MODERATE: parseFloat(process.env.GC_MODERATE_THRESHOLD || '0.92'),
        AGGRESSIVE: parseFloat(process.env.GC_AGGRESSIVE_THRESHOLD || '0.96'),
        EMERGENCY: parseFloat(process.env.GC_EMERGENCY_THRESHOLD || '0.98')
      },
      
      // 基于RSS增长率的阈值
      RSS_GROWTH_RATE: {
        WARNING: 0.2,         // 20%增长 - 警告
        CRITICAL: 0.5         // 50%增长 - 严重
      },
      
      // 基于内存碎片率的阈值
      FRAGMENTATION_RATIO: {
        HIGH: 0.3             // 30%碎片率 - 需要压缩
      }
    },
  
    // GC策略
    STRATEGIES: {
      // 保守策略：仅当必要时触发
      CONSERVATIVE: {
        interval: 5 * 60 * 1000,        // 5分钟检查一次
        cooldown: 2 * 60 * 1000,         // 2分钟冷却
        forceFullGC: process.env.GC_FORCE_FULL_GC === 'true' // 不强制完整GC
      },
      
      // 适度策略：定期触发
      MODERATE: {
        interval: 30 * 1000,         // 30秒检查一次
        cooldown: 15 * 1000,         // 15秒冷却
        forceFullGC: process.env.GC_FORCE_FULL_GC !== 'false' // 强制完整GC
      },
      
      // 激进策略：频繁触发
      AGGRESSIVE: {
        interval: 10 * 1000,         // 10秒检查一次
        cooldown: 5 * 1000,          // 5秒冷却
        forceFullGC: process.env.GC_FORCE_FULL_GC !== 'false' // 强制完整GC
      },
      
      // 紧急策略：立即触发
      EMERGENCY: {
        interval: 5 * 1000,          // 5秒检查一次
        cooldown: 2 * 1000,          // 2秒冷却
        forceFullGC: process.env.GC_FORCE_FULL_GC !== 'false' // 强制完整GC
      }
    },
    
    // 内存压缩策略
    COMPACTION: {
      ENABLED: process.env.GC_COMPACTION_ENABLED !== 'false',
      FRAGMENTATION_THRESHOLD: 0.3,   // 30%碎片率触发压缩
      MIN_MEMORY_SAVINGS: 50 * 1024 * 1024, // 至少节省50MB才执行
      INTERVAL: 5 * 60 * 1000        // 5分钟检查一次
    },
    
    // 监控配置 - 减少频繁检查
    MONITORING: {
      SAMPLE_INTERVAL: parseInt(process.env.GC_MONITORING_INTERVAL || '300000'),     // 5分钟采样一次
      HISTORY_SIZE: 20,               // 保留20个历史记录
      ALERT_THRESHOLD: 3              // 连续3次超过阈值才告警
    }
  };
};

// GC优化配置
const GC_OPTIMIZATION_CONFIG = getGCConfig();

// 内存历史数据
interface MemoryHistory {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  heapUsedPercent: number;
  smoothedHeapUsedPercent: number;
}

// GC统计
interface GCStats {
  totalGC: number;
  fullGC: number;
  incrementalGC: number;
  lastGCTime: number;
  averageGCDuration: number;
  memoryReclaimed: number;
}

class GCOptimizer {
  private strategy: keyof typeof GC_OPTIMIZATION_CONFIG.STRATEGIES = 'CONSERVATIVE';
  private lastGCTime = 0;
  private lastRSS = 0;
  private memoryHistory: MemoryHistory[] = [];
  private gcStats: GCStats = {
    totalGC: 0,
    fullGC: 0,
    incrementalGC: 0,
    lastGCTime: 0,
    averageGCDuration: 0,
    memoryReclaimed: 0
  };
  private monitorTimer: NodeJS.Timeout | null = null;
  private compactionTimer: NodeJS.Timeout | null = null;
  private consecutiveHighMemory = 0;
  
  // 策略稳定性控制
  private strategyStartTime = 0;
  private memoryReadings: number[] = [];
  private readonly MIN_STRATEGY_DURATION = parseInt(process.env.GC_STRATEGY_STABILITY_DURATION || '120000'); // 2分钟最小策略持续时间
  private readonly SMOOTHING_WINDOW = parseInt(process.env.GC_SMOOTHING_WINDOW || '5'); // 5个读数平滑窗口
  private readonly HYSTERESIS_ENABLED = process.env.GC_HYSTERESIS_ENABLED !== 'false'; // 启用滞后带
  
  // 策略滞后带配置
  private readonly STRATEGY_HYSTERESIS = {
    CONSERVATIVE: { lower: 0, upper: 0.75 },    // 0-75%
    MODERATE: { lower: 0.70, upper: 0.85 },     // 70-85%
    AGGRESSIVE: { lower: 0.80, upper: 0.93 },   // 80-93%
    EMERGENCY: { lower: 0.90, upper: 1.0 }      // 90-100%
  };

  constructor() {
    this.startMonitoring();
    this.startCompactionCheck();
    
    // 启用Node.js GC（如果可用）
    if (global.gc) {
      logger.info('Node.js GC已启用');
    } else {
      logger.warn('Node.js GC未启用，使用--expose-gc标志启动以获得更好的内存管理');
    }
  }

  /**
   * 获取平滑后的内存使用情况
   */
  private getSmoothedMemoryUsage(): number {
    const currentUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
    this.memoryReadings.push(currentUsage);
    
    if (this.memoryReadings.length > this.SMOOTHING_WINDOW) {
      this.memoryReadings.shift();
    }
    
    return this.memoryReadings.reduce((a, b) => a + b, 0) / this.memoryReadings.length;
  }

  /**
   * 获取当前内存使用情况
   */
  private getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    heapUsedPercent: number;
    fragmentationRatio: number;
    rssGrowthRate: number;
    smoothedHeapUsedPercent: number;
  } {
    const usage = process.memoryUsage();
    const heapUsedPercent = usage.heapTotal > 0 ? usage.heapUsed / usage.heapTotal : 0;
    const smoothedHeapUsedPercent = this.getSmoothedMemoryUsage();
    
    // 计算碎片率（估算）
    const fragmentationRatio = usage.heapTotal > usage.heapUsed ? 
      (usage.heapTotal - usage.heapUsed) / usage.heapTotal : 0;
    
    // 计算RSS增长率
    const rssGrowthRate = this.lastRSS > 0 ? 
      (usage.rss - this.lastRSS) / this.lastRSS : 0;
    
    this.lastRSS = usage.rss;
    
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      heapUsedPercent,
      smoothedHeapUsedPercent,
      fragmentationRatio,
      rssGrowthRate
    };
  }

  /**
   * 记录内存历史
   */
  private recordMemoryHistory(memory: any): void {
    const history: MemoryHistory = {
      timestamp: Date.now(),
      ...memory
    };
    
    this.memoryHistory.push(history);
    
    // 保持历史记录在限制范围内
    if (this.memoryHistory.length > GC_OPTIMIZATION_CONFIG.MONITORING.HISTORY_SIZE) {
      this.memoryHistory.shift();
    }
  }

  /**
   * 确定当前策略（使用滞后带和平滑内存使用）
   */
  private determineStrategy(memory: any): keyof typeof GC_OPTIMIZATION_CONFIG.STRATEGIES {
    const { THRESHOLDS } = GC_OPTIMIZATION_CONFIG;
    const smoothedUsage = memory.smoothedHeapUsedPercent;
    const currentStrategy = this.strategy;
    const now = Date.now();
    
    // 检查最小策略持续时间
    if (now - this.strategyStartTime < this.MIN_STRATEGY_DURATION) {
      return currentStrategy; // 保持当前策略
    }
    
    // 如果启用了滞后带，使用滞后带逻辑
    if (this.HYSTERESIS_ENABLED) {
      const currentHysteresis = this.STRATEGY_HYSTERESIS[currentStrategy];
      
      // 只有在超出当前策略的滞后带时才考虑切换
      if (smoothedUsage < currentHysteresis.lower || smoothedUsage > currentHysteresis.upper) {
        return this.determineStrategyByThresholds(memory, smoothedUsage);
      }
      
      return currentStrategy; // 在滞后带内，保持当前策略
    }
    
    // 如果没有启用滞后带，直接使用阈值判断
    return this.determineStrategyByThresholds(memory, smoothedUsage);
  }

  /**
   * 根据阈值确定策略
   */
  private determineStrategyByThresholds(memory: any, usage: number): keyof typeof GC_OPTIMIZATION_CONFIG.STRATEGIES {
    const { THRESHOLDS } = GC_OPTIMIZATION_CONFIG;
    
    // 检查紧急阈值
    if (usage >= THRESHOLDS.HEAP_USED_PERCENT.EMERGENCY) {
      return 'EMERGENCY';
    }
    
    // 检查严重阈值
    if (usage >= THRESHOLDS.HEAP_USED_PERCENT.AGGRESSIVE ||
        memory.rssGrowthRate >= THRESHOLDS.RSS_GROWTH_RATE.CRITICAL) {
      return 'AGGRESSIVE';
    }
    
    // 检查警告阈值
    if (usage >= THRESHOLDS.HEAP_USED_PERCENT.MODERATE ||
        memory.rssGrowthRate >= THRESHOLDS.RSS_GROWTH_RATE.WARNING) {
      return 'MODERATE';
    }
    
    return 'CONSERVATIVE';
  }

  /**
   * 执行垃圾回收
   */
  private async performGC(reason: string, strategy: keyof typeof GC_OPTIMIZATION_CONFIG.STRATEGIES): Promise<void> {
    const now = Date.now();
    const config = GC_OPTIMIZATION_CONFIG.STRATEGIES[strategy];
    
    // 检查冷却时间
    if (now - this.lastGCTime < config.cooldown) {
      return;
    }
    
    try {
      const beforeMemory = this.getMemoryUsage();
      logger.info('开始垃圾回收', {
        reason,
        strategy,
        heapUsedPercent: Math.round(beforeMemory.heapUsedPercent * 100) / 100,
        rssMB: Math.round(beforeMemory.rss / 1024 / 1024)
      });
      
      const gcStartTime = process.hrtime.bigint();
      
      // 执行GC
      if (global.gc) {
        if (config.forceFullGC) {
          // 强制完整GC
          global.gc();
          this.gcStats.fullGC++;
        } else {
          // 增量GC - 简单调用
          global.gc();
          this.gcStats.incrementalGC++;
        }
      } else if (process.env.GC_ALTERNATIVE_GC_ENABLED !== 'false') {
        // 使用替代方案触发GC
        await this.triggerAlternativeGC();
      } else {
        logger.warn('无法执行垃圾回收，global.gc不可用且替代GC已禁用');
      }
      
      const gcEndTime = process.hrtime.bigint();
      const gcDuration = Number(gcEndTime - gcStartTime) / 1000000; // 转换为毫秒
      
      // 计算回收的内存
      const afterMemory = this.getMemoryUsage();
      const memoryReclaimed = beforeMemory.heapUsed - afterMemory.heapUsed;
      
      // 更新统计
      this.gcStats.totalGC++;
      this.gcStats.lastGCTime = now;
      this.gcStats.averageGCDuration = 
        (this.gcStats.averageGCDuration * (this.gcStats.totalGC - 1) + gcDuration) / this.gcStats.totalGC;
      this.gcStats.memoryReclaimed += memoryReclaimed;
      
      this.lastGCTime = now;
      
      logger.info('垃圾回收完成', {
        strategy,
        duration: Math.round(gcDuration),
        memoryReclaimedMB: Math.round(memoryReclaimed / 1024 / 1024),
        heapUsedPercentAfter: Math.round(afterMemory.heapUsedPercent * 100) / 100,
        rssMBAfter: Math.round(afterMemory.rss / 1024 / 1024)
      });
      
    } catch (error) {
      logger.error('垃圾回收失败', error instanceof Error ? error as unknown as Record<string, unknown> : { message: String(error) });
    }
  }

  /**
   * 替代GC方案（当global.gc不可用时）
   */
  private async triggerAlternativeGC(): Promise<void> {
    // 创建和释放大对象来触发GC
    const largeObjects: any[] = [];
    
    try {
      // 创建多个大对象
      for (let i = 0; i < 5; i++) {
        const largeArray = new Array(1000000).fill({ data: 'x'.repeat(1000) });
        largeObjects.push(largeArray);
      }
      
      // 等待一下
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 释放引用
      largeObjects.length = 0;
      
      // 再次等待
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      logger.error('替代GC方案失败', error instanceof Error ? error as unknown as Record<string, unknown> : { message: String(error) });
    }
  }

  /**
   * 内存压缩（减少碎片）
   */
  private async performMemoryCompaction(): Promise<void> {
    if (!GC_OPTIMIZATION_CONFIG.COMPACTION.ENABLED) {
      return;
    }
    
    const memory = this.getMemoryUsage();
    
    // 检查是否需要压缩
    if (memory.fragmentationRatio < GC_OPTIMIZATION_CONFIG.COMPACTION.FRAGMENTATION_THRESHOLD) {
      return;
    }
    
    try {
      logger.info('开始内存压缩', {
        fragmentationRatio: Math.round(memory.fragmentationRatio * 100) / 100,
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024)
      });
      
      // 执行多次GC来压缩内存
      for (let i = 0; i < 3; i++) {
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const afterMemory = this.getMemoryUsage();
      const memorySaved = memory.heapTotal - afterMemory.heapTotal;
      
      logger.info('内存压缩完成', {
        memorySavedMB: Math.round(memorySaved / 1024 / 1024),
        newFragmentationRatio: Math.round(afterMemory.fragmentationRatio * 100) / 100
      });
      
    } catch (error) {
      logger.error('内存压缩失败', error instanceof Error ? error as unknown as Record<string, unknown> : { message: String(error) });
    }
  }

  /**
   * 监控循环
   */
  private async monitor(): Promise<void> {
    const memory = this.getMemoryUsage();
    
    // 记录历史
    this.recordMemoryHistory(memory);
    
    // 确定策略
    const newStrategy = this.determineStrategy(memory);
    
    // 如果策略变化
    if (newStrategy !== this.strategy) {
      const oldStrategy = this.strategy;
      this.strategy = newStrategy;
      this.strategyStartTime = Date.now(); // 重置策略开始时间
      
      logger.info('GC策略变化', {
        from: oldStrategy,
        to: newStrategy,
        reason: 'memory_pressure_change',
        smoothedUsage: Math.round(memory.smoothedHeapUsedPercent * 100) / 100,
        hysteresisBand: this.STRATEGY_HYSTERESIS[newStrategy]
      });
    }
    
    // 检查是否需要GC
    const config = GC_OPTIMIZATION_CONFIG.STRATEGIES[this.strategy];
    const shouldGC = Date.now() - this.lastGCTime >= config.interval;
    
    // 检查连续高内存（使用平滑后的使用率）
    if (memory.smoothedHeapUsedPercent >= GC_OPTIMIZATION_CONFIG.THRESHOLDS.HEAP_USED_PERCENT.MODERATE) {
      this.consecutiveHighMemory++;
    } else {
      this.consecutiveHighMemory = 0;
    }
    
    // 如果达到告警阈值且需要GC
    if (shouldGC && this.consecutiveHighMemory >= GC_OPTIMIZATION_CONFIG.MONITORING.ALERT_THRESHOLD) {
      await this.performGC('scheduled_monitoring', this.strategy);
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    this.monitorTimer = setInterval(() => {
      this.monitor().catch(error => {
        logger.error('GC监控失败', error instanceof Error ? error as unknown as Record<string, unknown> : { message: String(error) });
      });
    }, GC_OPTIMIZATION_CONFIG.MONITORING.SAMPLE_INTERVAL);
    
    logger.info('GC优化器已启动', {
      sampleInterval: GC_OPTIMIZATION_CONFIG.MONITORING.SAMPLE_INTERVAL
    });
  }

  /**
   * 启动压缩检查
   */
  private startCompactionCheck(): void {
    this.compactionTimer = setInterval(() => {
      this.performMemoryCompaction().catch(error => {
        logger.error('内存压缩检查失败', error instanceof Error ? error as unknown as Record<string, unknown> : { message: String(error) });
      });
    }, GC_OPTIMIZATION_CONFIG.COMPACTION.INTERVAL);
  }

  /**
   * 手动触发GC
   */
  public async manualGC(reason: string = 'manual'): Promise<void> {
    await this.performGC(reason, this.strategy);
  }

  /**
   * 获取统计信息
   */
  public getStats(): GCStats & {
    currentStrategy: string;
    memoryHistory: MemoryHistory[];
    currentMemory: any;
  } {
    return {
      ...this.gcStats,
      currentStrategy: this.strategy,
      memoryHistory: [...this.memoryHistory],
      currentMemory: this.getMemoryUsage()
    };
  }

  /**
   * 停止优化器
   */
  public stop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    
    if (this.compactionTimer) {
      clearInterval(this.compactionTimer);
      this.compactionTimer = null;
    }
    
    logger.info('GC优化器已停止');
  }
}

// 创建全局实例
const gcOptimizer = new GCOptimizer();

export { gcOptimizer, GC_OPTIMIZATION_CONFIG };
export type { MemoryHistory, GCStats };