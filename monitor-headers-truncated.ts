/**
 * Real-time monitoring script for ERR_RESPONSE_HEADERS_TRUNCATED errors
 * This script monitors the system for headers truncated errors and tracks retry success rates
 */

import { createLogger } from '@/lib/utils/security/secure-logger';

const logger = createLogger('HeadersTruncatedMonitor');

interface RetryStat {
  taskId: string;
  url: string;
  errorType: string;
  retryAttempt: number;
  retryStrategy: string;
  success: boolean;
  duration: number;
  timestamp: number;
  proxyUsed?: string;
}

interface MonitoringStats {
  totalRequests: number;
  headersTruncatedErrors: number;
  retryAttempts: Map<number, number>; // retry attempt number -> count
  retrySuccesses: Map<number, number>; // retry attempt number -> success count
  proxyFailureStats: Map<string, {
    errors: number;
    successes: number;
    lastError: number;
    lastSuccess: number;
  }>;
  recentRetries: RetryStat[];
}

class HeadersTruncatedMonitor {
  private stats: MonitoringStats;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.stats = {
      totalRequests: 0,
      headersTruncatedErrors: 0,
      retryAttempts: new Map(),
      retrySuccesses: new Map(),
      proxyFailureStats: new Map(),
      recentRetries: []
    };
  }

  start() {
    if (this.isRunning) {
      logger.warn('Monitor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Starting Headers Truncated Error Monitor');

    // Check every 5 seconds
    this.interval = setInterval(() => {
      this.checkSystemStatus();
    }, 5000);

    // Also check for completed tasks every 30 seconds
    setInterval(() => {
      this.analyzeCompletedTasks();
    }, 30000);
  }

  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    logger.info('🛑 Headers Truncated Error Monitor stopped');
    this.printFinalStats();
  }

  private async checkSystemStatus() {
    try {
      // Check current running tasks
      const response = await fetch('http://localhost:3000/api/batchopen/tasks');
      const tasks = await response.json();

      if (!Array.isArray(tasks)) {
        return;
      }

      const runningTasks = tasks.filter(task => task.status === 'running');
      
      if (runningTasks.length > 0) {
        logger.debug('📊 Monitoring running tasks:', {
          count: runningTasks.length,
          totalProgress: runningTasks.reduce((sum, task) => sum + task.progress, 0),
          totalTasks: runningTasks.reduce((sum, task) => sum + task.total, 0)
        });
      }

    } catch (error) {
      logger.debug('Error checking system status', { 
        message: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  private async analyzeCompletedTasks() {
    try {
      // This would typically query a database or log files
      // For now, we'll simulate by checking recent task completions
      logger.info('📈 Analyzing recent task completions for headers truncated patterns');
      
      // Print current stats
      this.printCurrentStats();
      
    } catch (error) {
      logger.error('Error analyzing completed tasks', error instanceof Error ? error : new Error(String(error)));
    }
  }

  recordRetry(stat: RetryStat) {
    this.stats.recentRetries.push(stat);
    
    // Keep only last 1000 retries
    if (this.stats.recentRetries.length > 1000) {
      this.stats.recentRetries = this.stats.recentRetries.slice(-1000);
    }

    // Update retry attempts count
    const currentAttempts = this.stats.retryAttempts.get(stat.retryAttempt) || 0;
    this.stats.retryAttempts.set(stat.retryAttempt, currentAttempts + 1);

    // Update success count
    if (stat.success) {
      const currentSuccesses = this.stats.retrySuccesses.get(stat.retryAttempt) || 0;
      this.stats.retrySuccesses.set(stat.retryAttempt, currentSuccesses + 1);
    }

    // Update proxy stats
    if (stat.proxyUsed) {
      const proxyStats = this.stats.proxyFailureStats.get(stat.proxyUsed) || {
        errors: 0,
        successes: 0,
        lastError: 0,
        lastSuccess: 0
      };

      if (stat.success) {
        proxyStats.successes++;
        proxyStats.lastSuccess = stat.timestamp;
      } else {
        proxyStats.errors++;
        proxyStats.lastError = stat.timestamp;
      }

      this.stats.proxyFailureStats.set(stat.proxyUsed, proxyStats);
    }

    // Log significant retry events
    if (stat.retryAttempt === 1) {
      logger.info('🔄 First retry attempt for headers truncated error', {
        taskId: stat.taskId,
        url: stat.url,
        strategy: stat.retryStrategy
      });
    } else if (stat.retryAttempt === 3) {
      logger.warn('⚠️ Third retry attempt for headers truncated error', {
        taskId: stat.taskId,
        url: stat.url,
        previousAttempts: this.stats.retryAttempts.get(stat.retryAttempt - 1) || 0
      });
    }

    if (stat.success) {
      logger.info('✅ Retry successful for headers truncated error', {
        taskId: stat.taskId,
        retryAttempt: stat.retryAttempt,
        duration: `${stat.duration}ms`,
        strategy: stat.retryStrategy
      });
    }
  }

  recordHeadersTruncatedError(taskId: string, url: string, proxy?: string) {
    this.stats.headersTruncatedErrors++;
    this.stats.totalRequests++;

    logger.warn('🚨 Headers truncated error detected', {
      taskId,
      url,
      proxy: proxy || 'unknown',
      totalErrors: this.stats.headersTruncatedErrors,
      errorRate: `${((this.stats.headersTruncatedErrors / this.stats.totalRequests) * 100).toFixed(2)}%`
    });
  }

  private printCurrentStats() {
    const now = Date.now();
    const recentRetries = this.stats.recentRetries.filter(r => now - r.timestamp < 300000); // Last 5 minutes
    
    logger.info('\n📊 Current Headers Truncated Error Stats:');
    logger.info('=====================================');
    logger.info(`Total Requests: ${this.stats.totalRequests}`);
    logger.info(`Headers Truncated Errors: ${this.stats.headersTruncatedErrors}`);
    logger.info(`Error Rate: ${this.stats.totalRequests > 0 ? ((this.stats.headersTruncatedErrors / this.stats.totalRequests) * 100).toFixed(2) : 0}%`);
    logger.info(`Recent Retries (5min): ${recentRetries.length}`);
    
    // Retry success rates by attempt number
    logger.info('\n🔄 Retry Success Rates by Attempt:');
    for (let i = 1; i <= 3; i++) {
      const attempts = this.stats.retryAttempts.get(i) || 0;
      const successes = this.stats.retrySuccesses.get(i) || 0;
      const successRate = attempts > 0 ? ((successes / attempts) * 100).toFixed(1) : 0;
      logger.info(`  Attempt ${i}: ${successes}/${attempts} (${successRate}%)`);
    }
    
    // Top problematic proxies
    const problematicProxies = Array.from(this.stats.proxyFailureStats.entries())
      .filter(([_, stats]) => stats.errors > 0)
      .sort((a, b) => b[1].errors - a[1].errors)
      .slice(0, 5);
    
    if (problematicProxies.length > 0) {
      logger.info('\n🌐 Top Problematic Proxies:');
      problematicProxies.forEach(([proxy, stats]) => {
        const errorRate = ((stats.errors / (stats.errors + stats.successes)) * 100).toFixed(1);
        logger.info(`  ${proxy}: ${stats.errors} errors, ${stats.successes} successes (${errorRate}% error rate)`);
      });
    }
    
    logger.info('=====================================\n');
  }

  private printFinalStats() {
    logger.info('\n📊 Final Headers Truncated Error Statistics:');
    logger.info('=========================================');
    logger.info(`Monitoring Duration: ${this.isRunning ? 'Unknown' : 'Stopped'}`);
    logger.info(`Total Requests Monitored: ${this.stats.totalRequests}`);
    logger.info(`Total Headers Truncated Errors: ${this.stats.headersTruncatedErrors}`);
    
    if (this.stats.totalRequests > 0) {
      const overallErrorRate = (this.stats.headersTruncatedErrors / this.stats.totalRequests) * 100;
      logger.info(`Overall Error Rate: ${overallErrorRate.toFixed(2)}%`);
    }
    
    // Overall retry statistics
    let totalRetries = 0;
    let totalRetrySuccesses = 0;
    
    for (let i = 1; i <= 3; i++) {
      const attempts = this.stats.retryAttempts.get(i) || 0;
      const successes = this.stats.retrySuccesses.get(i) || 0;
      totalRetries += attempts;
      totalRetrySuccesses += successes;
      
      if (attempts > 0) {
        const successRate = ((successes / attempts) * 100).toFixed(1);
        logger.info(`Retry ${i} Success Rate: ${successes}/${attempts} (${successRate}%)`);
      }
    }
    
    if (totalRetries > 0) {
      const overallRetrySuccessRate = ((totalRetrySuccesses / totalRetries) * 100).toFixed(1);
      logger.info(`Overall Retry Success Rate: ${totalRetrySuccesses}/${totalRetries} (${overallRetrySuccessRate}%)`);
      
      // Calculate how many errors were resolved by retries
      const errorsResolvedByRetries = totalRetrySuccesses;
      const resolutionRate = this.stats.headersTruncatedErrors > 0 
        ? ((errorsResolvedByRetries / this.stats.headersTruncatedErrors) * 100).toFixed(1)
        : 0;
      logger.info(`Error Resolution Rate: ${errorsResolvedByRetries}/${this.stats.headersTruncatedErrors} (${resolutionRate}%)`);
    }
    
    logger.info('=========================================\n');
  }

  getStats() {
    return {
      totalRequests: this.stats.totalRequests,
      headersTruncatedErrors: this.stats.headersTruncatedErrors,
      errorRate: this.stats.totalRequests > 0 
        ? (this.stats.headersTruncatedErrors / this.stats.totalRequests) * 100 
        : 0,
      retryAttempts: Object.fromEntries(this.stats.retryAttempts),
      retrySuccesses: Object.fromEntries(this.stats.retrySuccesses),
      recentRetriesCount: this.stats.recentRetries.length,
      proxyStats: Object.fromEntries(
        Array.from(this.stats.proxyFailureStats.entries()).map(([proxy, stats]) => [
          proxy,
          {
            ...stats,
            errorRate: stats.errors + stats.successes > 0 
              ? (stats.errors / (stats.errors + stats.successes)) * 100 
              : 0
          }
        ])
      )
    };
  }
}

// Export singleton instance
const headersTruncatedMonitor = new HeadersTruncatedMonitor();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down monitor...');
  headersTruncatedMonitor.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down monitor...');
  headersTruncatedMonitor.stop();
  process.exit(0);
});

// Start monitor if this is the main module
if (require.main === module) {
  logger.info('🚀 Starting Headers Truncated Error Monitor');
  headersTruncatedMonitor.start();
  
  // Keep the process alive
  setInterval(() => {
    // Heartbeat
  }, 60000);
}

export { HeadersTruncatedMonitor, headersTruncatedMonitor };
export type { RetryStat, MonitoringStats };