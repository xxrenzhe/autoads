#!/usr/bin/env node

import { autoClickPerformanceService } from '@/lib/services/autoclick-performance-service';
import { AutoClickService } from '@/lib/autoclick-service';
import { prisma } from '@/lib/prisma';
import { autoClickCacheService } from '@/lib/services/autoclick-cache-service';

/**
 * AutoClick Performance Test Script
 * 测试系统在高并发情况下的性能表现
 */

interface TestConfig {
  taskCount: number;
  concurrentUsers: number;
  testDuration: number; // minutes
  clickDistribution: 'uniform' | 'normal' | 'burst';
}

interface TestResult {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  throughput: number; // tasks per minute
  successRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage?: number;
  errors: Array<{ taskId: string; error: string; timestamp: Date }>;
}

class AutoClickPerformanceTest {
  private config: TestConfig;
  private results: TestResult;
  private startTime: Date;
  private errors: Array<{ taskId: string; error: string; timestamp: Date }> = [];
  private taskResults: Array<{ taskId: string; startTime: Date; endTime?: Date; success: boolean }> = [];

  constructor(config: TestConfig) {
    this.config = config;
    this.results = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: 0,
      throughput: 0,
      successRate: 0,
      memoryUsage: process.memoryUsage(),
      errors: []
    };
  }

  /**
   * 运行性能测试
   */
  async run(): Promise<TestResult> {
    console.log('=== AutoClick Performance Test ===');
    console.log('Configuration:', this.config);
    
    this.startTime = new Date();
    
    try {
      // 1. 准备测试数据
      await this.prepareTestData();
      
      // 2. 获取初始性能指标
      const initialMetrics = autoClickPerformanceService.getMetrics();
      console.log('Initial metrics:', initialMetrics);
      
      // 3. 运行并发测试
      await this.runConcurrentTest();
      
      // 4. 收集测试结果
      await this.collectResults();
      
      // 5. 清理测试数据
      await this.cleanupTestData();
      
      return this.results;
      
    } catch (error) {
      console.error('Performance test failed:', error);
      throw error;
    }
  }

  /**
   * 准备测试数据
   */
  private async prepareTestData(): Promise<void> {
    console.log('\n1. Preparing test data...');
    
    // 创建测试用户
    const testUser = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER'
      }
    });

    // 创建测试任务
    const taskPromises = [];
    for (let i = 0; i < this.config.taskCount; i++) {
      taskPromises.push(this.createTestTask(testUser.id, i));
    }
    
    await Promise.all(taskPromises);
    console.log(`Created ${this.config.taskCount} test tasks`);
  }

  /**
   * 创建测试任务
   */
  private async createTestTask(userId: string, index: number): Promise<string> {
    const task = await prisma.autoClickTask.create({
      data: {
        userId,
        offerUrl: `https://example.com/offer-${index}`,
        referer: `https://example.com/referer-${index}`,
        dailyClicks: Math.floor(Math.random() * 100) + 50, // 50-150 clicks
        timeWindow: 'all_day',
        status: 'running'
      }
    });

    // 为任务创建今日执行计划
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await prisma.dailyExecutionPlan.create({
      data: {
        taskId: task.id,
        executionDate: today,
        hourlyClicks: this.generateHourlyDistribution(task.dailyClicks),
        currentVisitor: 'simple'
      }
    });

    return task.id;
  }

  /**
   * 生成小时点击分布
   */
  private generateHourlyDistribution(totalClicks: number): number[] {
    const distribution = new Array(24).fill(0);
    const activeHours = [9, 10, 11, 14, 15, 16, 19, 20, 21]; // 工作时间
    
    const clicksPerHour = Math.floor(totalClicks / activeHours.length);
    let remaining = totalClicks % activeHours.length;
    
    for (const hour of activeHours) {
      distribution[hour] = clicksPerHour + (remaining > 0 ? 1 : 0);
      if (remaining > 0) remaining--;
    }
    
    return distribution;
  }

  /**
   * 运行并发测试
   */
  private async runConcurrentTest(): Promise<void> {
    console.log('\n2. Running concurrent test...');
    
    // 获取所有测试任务
    const tasks = await prisma.autoClickTask.findMany({
      where: { 
        user: { email: 'test@example.com' },
        status: 'running'
      }
    });
    
    const taskIds = tasks.map(t => t.id);
    
    // 执行并发任务
    await autoClickPerformanceService.executeConcurrentTasks(taskIds);
    
    // 等待测试完成或超时
    const endTime = new Date(this.startTime.getTime() + this.config.testDuration * 60 * 1000);
    
    while (new Date() < endTime) {
      await this.sleep(5000); // 每5秒检查一次
      
      const activeCount = await prisma.autoClickTask.count({
        where: { 
          user: { email: 'test@example.com' },
          status: 'running'
        }
      });
      
      if (activeCount === 0) {
        console.log('All tasks completed');
        break;
      }
      
      console.log(`Active tasks: ${activeCount}`);
    }
    
    console.log('Concurrent test completed');
  }

  /**
   * 收集测试结果
   */
  private async collectResults(): Promise<void> {
    console.log('\n3. Collecting results...');
    
    // 获取任务执行统计
    const taskStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_tasks,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_tasks,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as avg_execution_time,
        MAX(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as max_execution_time,
        MIN(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) as min_execution_time
      FROM auto_click_task 
      WHERE user_id = (SELECT id FROM user WHERE email = 'test@example.com')
    ` as any[];

    const stats = taskStats[0];
    
    // 计算吞吐量
    const durationMinutes = (new Date().getTime() - this.startTime.getTime()) / (1000 * 60);
    const throughput = stats.total_tasks / durationMinutes;
    
    // 计算成功率
    const successRate = stats.total_tasks > 0 
      ? (stats.successful_tasks / stats.total_tasks) * 100 
      : 0;
    
    this.results = {
      totalTasks: stats.total_tasks || 0,
      successfulTasks: stats.successful_tasks || 0,
      failedTasks: stats.failed_tasks || 0,
      averageExecutionTime: stats.avg_execution_time || 0,
      maxExecutionTime: stats.max_execution_time || 0,
      minExecutionTime: stats.min_execution_time || 0,
      throughput,
      successRate,
      memoryUsage: process.memoryUsage(),
      errors: this.errors
    };
    
    // 获取系统性能指标
    const finalMetrics = autoClickPerformanceService.getMetrics();
    console.log('Final metrics:', finalMetrics);
    
    // 获取缓存统计
    const cacheStats = await autoClickCacheService.getCacheStats();
    console.log('Cache stats:', cacheStats);
  }

  /**
   * 清理测试数据
   */
  private async cleanupTestData(): Promise<void> {
    console.log('\n4. Cleaning up test data...');
    
    // 删除测试任务
    await prisma.autoClickTask.deleteMany({
      where: { 
        user: { email: 'test@example.com' }
      }
    });
    
    // 删除测试用户
    await prisma.user.delete({
      where: { email: 'test@example.com' }
    });
    
    console.log('Test data cleaned up');
  }

  /**
   * 生成测试报告
   */
  generateReport(): string {
    const report = [
      '\n=== Performance Test Report ===',
      `Test Duration: ${this.config.testDuration} minutes`,
      `Total Tasks: ${this.results.totalTasks}`,
      `Successful Tasks: ${this.results.successfulTasks}`,
      `Failed Tasks: ${this.results.failedTasks}`,
      `Success Rate: ${this.results.successRate.toFixed(2)}%`,
      `Average Execution Time: ${this.results.averageExecutionTime.toFixed(2)}ms`,
      `Max Execution Time: ${this.results.maxExecutionTime.toFixed(2)}ms`,
      `Min Execution Time: ${this.results.minExecutionTime.toFixed(2)}ms`,
      `Throughput: ${this.results.throughput.toFixed(2)} tasks/minute`,
      '\nMemory Usage:',
      `  RSS: ${(this.results.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      `  Heap Total: ${(this.results.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      `  Heap Used: ${(this.results.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      `  External: ${(this.results.memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    ];
    
    if (this.results.errors.length > 0) {
      report.push('\nErrors:');
      this.results.errors.forEach(error => {
        report.push(`  ${error.timestamp.toISOString()} - Task ${error.taskId}: ${error.error}`);
      });
    }
    
    return report.join('\n');
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 运行测试
async function main() {
  const testConfig: TestConfig = {
    taskCount: 100,
    concurrentUsers: 50,
    testDuration: 10,
    clickDistribution: 'normal'
  };
  
  const test = new AutoClickPerformanceTest(testConfig);
  
  try {
    const results = await test.run();
    console.log(test.generateReport());
    
    // 输出到文件
    const fs = require('fs');
    const reportPath = './performance-test-report.txt';
    fs.writeFileSync(reportPath, test.generateReport());
    console.log(`\nReport saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { AutoClickPerformanceTest, TestConfig, TestResult };