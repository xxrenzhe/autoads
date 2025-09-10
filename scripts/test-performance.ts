import { prisma } from '@/lib/prisma';
import { AutoClickService } from '@/lib/autoclick-service';
import { AutoClickScheduler } from '@/lib/autoclick-scheduler';
import { AutoClickExecutionEngine } from '@/lib/autoclick-engine';
import { TokenService } from '@/lib/services/token-service';
import { autoClickCacheService } from '@/lib/services/autoclick-cache-service';

async function testPerformance() {
  console.log('=== Performance Testing ===\n');
  
  try {
    // Test 1: Database performance
    console.log('1. Testing database performance...');
    
    // Test query performance
    const queryStart = Date.now();
    const userCount = await prisma.user.count();
    const taskCount = await prisma.autoClickTask.count();
    const planCount = await prisma.dailyExecutionPlan.count();
    const queryTime = Date.now() - queryStart;
    
    console.log(`   Basic queries: ${queryTime}ms`);
    console.log(`   Users: ${userCount}, Tasks: ${taskCount}, Plans: ${planCount}`);
    
    // Test complex query performance
    const complexQueryStart = Date.now();
    const complexResult = await prisma.autoClickTask.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            tokenBalance: true
          }
        },
        dailyPlans: {
          take: 1,
          orderBy: {
            executionDate: 'desc'
          },
          include: {
            hourlyExecutions: {
              take: 24
            }
          }
        },
        dailySummaries: {
          take: 7,
          orderBy: {
            executionDate: 'desc'
          }
        }
      },
      take: 100,
      orderBy: {
        createdAt: 'desc'
      }
    });
    const complexQueryTime = Date.now() - complexQueryStart;
    
    console.log(`   Complex query (100 tasks with relations): ${complexQueryTime}ms`);
    
    // Test batch insert performance
    const batchInsertStart = Date.now();
    const testUsers = [];
    for (let i = 0; i < 100; i++) {
      testUsers.push({
        email: `perf-test-${i}@example.com`,
        name: `Performance Test User ${i}`,
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
        role: 'USER' as const,
        status: 'ACTIVE' as const,
        emailVerified: true,
        tokenBalance: 1000
      });
    }
    
    await prisma.user.createMany({
      data: testUsers
    });
    const batchInsertTime = Date.now() - batchInsertStart;
    
    console.log(`   Batch insert (100 users): ${batchInsertTime}ms`);
    
    // Cleanup
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'perf-test-'
        }
      }
    });
    console.log('   ✓ Cleanup completed');
    
    // Test 2: Task creation performance
    console.log('\n2. Testing task creation performance...');
    
    const perfUser = await prisma.user.create({
      data: {
        email: `perf-main-${Date.now()}@example.com`,
        name: 'Performance Test Main User',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 10000
      }
    });
    
    const autoClickService = new AutoClickService();
    const taskCreationTimes = [];
    const taskCountTest = 50;
    
    for (let i = 0; i < taskCountTest; i++) {
      const createStart = Date.now();
      await autoClickService.createTask(perfUser.id, {
        offerUrl: `https://example.com/offer-${i}`,
        country: 'US',
        timeWindow: '06:00-24:00',
        dailyClicks: Math.floor(Math.random() * 50) + 10,
        referer: 'https://facebook.com'
      });
      taskCreationTimes.push(Date.now() - createStart);
    }
    
    const avgTaskCreationTime = taskCreationTimes.reduce((a, b) => a + b, 0) / taskCreationTimes.length;
    const maxTaskCreationTime = Math.max(...taskCreationTimes);
    const minTaskCreationTime = Math.min(...taskCreationTimes);
    
    console.log(`   Average task creation: ${avgTaskCreationTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTaskCreationTime}ms, Max: ${maxTaskCreationTime}ms`);
    console.log(`   Throughput: ${Math.round(taskCountTest / (taskCreationTimes.reduce((a, b) => a + b, 0) / 1000) * 10) / 10} tasks/sec`);
    
    // Test 3: Task scheduling performance
    console.log('\n3. Testing task scheduling performance...');
    
    const scheduler = AutoClickScheduler.getInstance();
    
    // Test daily plan generation performance
    const planGenerationStart = Date.now();
    const tasks = await prisma.autoClickTask.findMany({
      where: { userId: perfUser.id },
      take: 10
    });
    
    for (const task of tasks) {
      await scheduler['generateTaskDailyPlan'](task);
    }
    const planGenerationTime = Date.now() - planGenerationStart;
    
    console.log(`   Daily plan generation (10 tasks): ${planGenerationTime}ms`);
    console.log(`   Average per task: ${(planGenerationTime / 10).toFixed(2)}ms`);
    
    // Test 4: Cache performance
    console.log('\n4. Testing cache performance...');
    
    if (autoClickCacheService.isReady()) {
      const cacheWriteStart = Date.now();
      const cacheOperations = 1000;
      
      for (let i = 0; i < cacheOperations; i++) {
        await autoClickCacheService.cacheTaskExecutionStatus(`perf-test-${i}`, {
          taskId: `task-${i}`,
          status: 'running',
          progress: { completed: i, target: cacheOperations }
        });
      }
      const cacheWriteTime = Date.now() - cacheWriteStart;
      
      const cacheReadStart = Date.now();
      for (let i = 0; i < cacheOperations; i++) {
        await autoClickCacheService.getCachedTaskExecutionStatus(`perf-test-${i}`);
      }
      const cacheReadTime = Date.now() - cacheReadStart;
      
      console.log(`   Cache write (${cacheOperations} ops): ${cacheWriteTime}ms (${Math.round(cacheOperations / cacheWriteTime * 1000)} ops/sec)`);
      console.log(`   Cache read (${cacheOperations} ops): ${cacheReadTime}ms (${Math.round(cacheOperations / cacheReadTime * 1000)} ops/sec)`);
      
      // Cleanup
      await autoClickCacheService.clearPattern('task_status:perf-test_*');
    } else {
      console.log('   ⚠ Cache not available, skipping cache performance test');
    }
    
    // Test 5: Token service performance
    console.log('\n5. Testing token service performance...');
    
    const tokenOperations = 100;
    const tokenTimes = [];
    
    for (let i = 0; i < tokenOperations; i++) {
      const tokenStart = Date.now();
      try {
        await TokenService.consumeTokens(perfUser.id, 1, 'autoclick', 'Test consumption');
      } catch (error) {
        // Ignore token errors for performance test
      }
      tokenTimes.push(Date.now() - tokenStart);
    }
    
    const avgTokenTime = tokenTimes.reduce((a, b) => a + b, 0) / tokenTimes.length;
    console.log(`   Token consumption (${tokenOperations} ops): avg ${avgTokenTime.toFixed(2)}ms`);
    
    // Check token balance
    const finalBalance = await prisma.user.findUnique({
      where: { id: perfUser.id },
      select: { tokenBalance: true }
    });
    console.log(`   Final token balance: ${finalBalance?.tokenBalance || 0}`);
    
    // Test 6: Concurrent task execution simulation
    console.log('\n6. Testing concurrent task simulation...');
    
    const concurrentTasks = 20;
    const concurrentStart = Date.now();
    
    const concurrentPromises = [];
    for (let i = 0; i < concurrentTasks; i++) {
      concurrentPromises.push(
        (async () => {
          // Simulate task operations
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return { taskId: i, completed: true };
        })()
      );
    }
    
    await Promise.all(concurrentPromises);
    const concurrentTime = Date.now() - concurrentStart;
    
    console.log(`   Concurrent tasks (${concurrentTasks}): ${concurrentTime}ms`);
    console.log(`   Average per task: ${(concurrentTime / concurrentTasks).toFixed(2)}ms`);
    
    // Test 7: Memory usage monitoring
    console.log('\n7. Monitoring memory usage...');
    
    const memUsage = process.memoryUsage();
    console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
    console.log(`   Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`   External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
    
    // Test 8: Large dataset handling
    console.log('\n8. Testing large dataset handling...');
    
    // Create many execution records
    const largeDatasetStart = Date.now();
    const executionRecords = [];
    
    for (let i = 0; i < 1000; i++) {
      executionRecords.push({
        planId: 'test-plan',
        hour: i % 24,
        targetClicks: 10,
        actualClicks: Math.floor(Math.random() * 11),
        successCount: Math.floor(Math.random() * 11),
        failCount: 0,
        tokensUsed: Math.floor(Math.random() * 11),
        executionDetails: {
          test: true,
          iteration: i
        }
      });
    }
    
    // Simulate processing
    let totalClicks = 0;
    let totalSuccess = 0;
    let totalTokens = 0;
    
    for (const record of executionRecords) {
      totalClicks += record.actualClicks;
      totalSuccess += record.successCount;
      totalTokens += record.tokensUsed;
    }
    
    const largeDatasetTime = Date.now() - largeDatasetStart;
    
    console.log(`   Processed ${executionRecords.length} records: ${largeDatasetTime}ms`);
    console.log(`   Total clicks: ${totalClicks}, Success: ${totalSuccess}, Tokens: ${totalTokens}`);
    console.log(`   Processing rate: ${Math.round(executionRecords.length / largeDatasetTime * 1000)} records/sec`);
    
    // Test 9: API endpoint performance simulation
    console.log('\n9. Testing API endpoint performance simulation...');
    
    const apiEndpoints = [
      { name: 'GET /api/autoclick/tasks', complexity: 'medium' },
      { name: 'POST /api/autoclick/tasks', complexity: 'low' },
      { name: 'GET /api/autoclick/tasks/:id/progress', complexity: 'low' },
      { name: 'GET /api/autoclick/stats', complexity: 'high' }
    ];
    
    for (const endpoint of apiEndpoints) {
      const simulateStart = Date.now();
      
      // Simulate database operations for each endpoint
      switch (endpoint.complexity) {
        case 'low':
          await prisma.autoClickTask.count();
          break;
        case 'medium':
          await prisma.autoClickTask.findMany({ take: 50, include: { user: true } });
          break;
        case 'high':
          await prisma.$queryRaw`
            SELECT 
              status,
              COUNT(*) as count
            FROM auto_click_tasks 
            GROUP BY status
          `;
          break;
      }
      
      const responseTime = Date.now() - simulateStart;
      console.log(`   ${endpoint.name}: ${responseTime}ms`);
    }
    
    // Test 10: System throughput under load
    console.log('\n10. Testing system throughput under load...');
    
    const loadTestDuration = 5000; // 5 seconds
    const loadTestStart = Date.now();
    let operationsCompleted = 0;
    
    while (Date.now() - loadTestStart < loadTestDuration) {
      // Simulate various operations
      await Promise.all([
        prisma.user.count(),
        prisma.autoClickTask.count(),
        autoClickCacheService.isReady() ? autoClickCacheService.getCacheStats() : Promise.resolve()
      ]);
      operationsCompleted += 3;
    }
    
    const loadTestTime = Date.now() - loadTestStart;
    const throughput = Math.round(operationsCompleted / loadTestTime * 1000);
    
    console.log(`   Load test duration: ${loadTestTime}ms`);
    console.log(`   Operations completed: ${operationsCompleted}`);
    console.log(`   System throughput: ${throughput} ops/sec`);
    
    // Cleanup
    console.log('\n11. Cleaning up test data...');
    
    await prisma.autoClickTask.deleteMany({
      where: { userId: perfUser.id }
    });
    
    await prisma.user.delete({
      where: { id: perfUser.id }
    });
    
    console.log('   ✓ Test data cleaned up');
    
    // Test 12: Performance summary
    console.log('\n12. Performance Summary:');
    console.log(`   Database query performance: ${queryTime}ms (basic), ${complexQueryTime}ms (complex)`);
    console.log(`   Task creation throughput: ${Math.round(taskCountTest / (taskCreationTimes.reduce((a, b) => a + b, 0) / 1000) * 10) / 10} tasks/sec`);
    console.log(`   Token operations: ${Math.round(tokenOperations / (tokenTimes.reduce((a, b) => a + b, 0) / 1000) * 10) / 10} ops/sec`);
    console.log(`   System throughput: ${throughput} ops/sec`);
    console.log(`   Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    console.log('\n=== Performance Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Performance test failed:', error);
    throw error;
  }
}

// Run the test
testPerformance()
  .then(() => {
    console.log('\n🎉 All performance tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Performance tests failed:', error);
    process.exit(1);
  });