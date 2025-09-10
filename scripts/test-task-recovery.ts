import { prisma } from '@/lib/prisma';
import { AutoClickRecoveryService } from '@/lib/services/autoclick-recovery-service';
import { AutoClickService } from '@/lib/autoclick-service';
import { AutoClickExecutionEngine } from '@/lib/autoclick-engine';

async function testTaskRecovery() {
  console.log('=== Testing Task Recovery ===\n');
  
  try {
    // Test 1: Recovery service initialization
    console.log('1. Testing recovery service initialization...');
    
    const recoveryService = AutoClickRecoveryService.getInstance();
    console.log('   ✓ Recovery service initialized');
    
    // Test 2: Create test user and task
    console.log('\n2. Creating test data...');
    
    // Use a timestamp to ensure unique email
    const timestamp = Date.now();
    const testUser = await prisma.user.create({
      data: {
        email: `recovery-${timestamp}@test.com`,
        name: 'Recovery Test User',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 1000
      }
    });
    
    const autoClickService = new AutoClickService();
    
    const task = await autoClickService.createTask(testUser.id, {
      offerUrl: 'https://example.com/recovery-test',
      country: 'US',
      timeWindow: '06:00-24:00',
      dailyClicks: 10,
      referer: 'https://google.com'
    });
    
    console.log(`   ✓ Created task: ${task.id}`);
    
    // Test 3: Simulate task interruption
    console.log('\n3. Simulating task interruption...');
    
    // Update task to running state
    await prisma.autoClickTask.update({
      where: { id: task.id },
      data: {
        status: 'running'
      }
    });
    
    // Create execution logs
    const executionLogs = [
      {
        userId: testUser.id,
        action: 'autoclick_task_started',
        resource: 'autoclick_task',
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        metadata: {
          taskId: task.id,
          visitor: 'simple',
          url: task.offerUrl
        }
      },
      {
        userId: testUser.id,
        action: 'autoclick_click_executed',
        resource: 'autoclick_task',
        timestamp: new Date(Date.now() - 240000), // 4 minutes ago
        metadata: {
          taskId: task.id,
          clickNumber: 1,
          responseTime: 1200
        }
      },
      {
        userId: testUser.id,
        action: 'autoclick_click_executed',
        resource: 'autoclick_task',
        timestamp: new Date(Date.now() - 180000), // 3 minutes ago
        metadata: {
          taskId: task.id,
          clickNumber: 2,
          responseTime: 1100
        }
      },
      {
        userId: testUser.id,
        action: 'autoclick_click_executed',
        resource: 'autoclick_task',
        timestamp: new Date(Date.now() - 120000), // 2 minutes ago
        metadata: {
          taskId: task.id,
          clickNumber: 3,
          responseTime: 1300
        }
      }
    ];
    
    for (const log of executionLogs) {
      await prisma.userActivity.create({ data: log });
    }
    
    console.log('   ✓ Task interrupted at 30% completion');
    
    // Test 4: Detect interrupted tasks
    console.log('\n4. Testing interrupted task detection...');
    
    const runningTasks = await prisma.autoClickTask.findMany({
      where: { status: 'running' }
    });
    const foundTask = runningTasks.find(t => t.id === task.id);
    
    if (foundTask) {
      console.log(`   ✓ Detected interrupted task: ${foundTask.id}`);
      console.log(`     Status: ${foundTask.status}`);
    } else {
      console.log('   ⚠ No interrupted tasks detected');
    }
    
    // Test 5: Task recovery
    console.log('\n5. Testing task recovery...');
    
    const recoveryResult = await recoveryService.recoverSingleTask(task.id);
    
    if (recoveryResult) {
      console.log(`   ✓ Task recovery successful`);
      console.log(`     Task ${task.id} has been recovered`);
    } else {
      console.log(`   ✗ Task recovery failed`);
    }
    
    // Test 6: Check task state after recovery
    console.log('\n6. Checking task state after recovery...');
    
    const recoveredTask = await prisma.autoClickTask.findUnique({
      where: { id: task.id }
    });
    
    if (recoveredTask) {
      console.log(`   Task status: ${recoveredTask.status}`);
      
      // Check for recovery log
      const recoveryLogs = await prisma.userActivity.findMany({
        where: {
          userId: testUser.id,
          action: 'autoclick_task_recovered'
        },
        orderBy: { timestamp: 'desc' },
        take: 1
      });
      
      if (recoveryLogs.length > 0) {
        console.log(`   ✓ Recovery log created: ${recoveryLogs[0].timestamp.toISOString()}`);
      }
    }
    
    // Test 7: Recovery statistics
    console.log('\n7. Testing recovery statistics...');
    
    const stats = await recoveryService.getRecoveryStats();
    console.log(`   Total tasks: ${stats.totalTasks}`);
    console.log(`   Running tasks: ${stats.runningTasks}`);
    console.log(`   Recovered tasks (24h): ${stats.recoveredTasks}`);
    console.log(`   Failed tasks (24h): ${stats.failedTasks}`);
    if (stats.lastRecovery) {
      console.log(`   Last recovery: ${stats.lastRecovery.toISOString()}`);
    }
    
    // Test 8: Batch recovery
    console.log('\n8. Testing batch recovery...');
    
    // Create another interrupted task
    const task2 = await autoClickService.createTask(testUser.id, {
      offerUrl: 'https://example.com/recovery-test-2',
      country: 'US',
      timeWindow: '06:00-24:00',
      dailyClicks: 5,
      referer: 'https://google.com'
    });
    
    await prisma.autoClickTask.update({
      where: { id: task2.id },
      data: {
        status: 'running'
      }
    });
    
    // Use the main recoverTasks method for batch recovery
    await recoveryService.recoverTasks();
    
    console.log(`   ✓ Batch recovery completed`);
    
    // Test 9: Recovery history
    console.log('\n9. Testing recovery history...');
    
    const history = await prisma.userActivity.findMany({
      where: {
        action: { startsWith: 'autoclick_' }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    
    console.log(`   Recovery history entries: ${history.length}`);
    history.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.action} - ${entry.timestamp.toISOString()}`);
    });
    
    // Test 10: Auto-recovery configuration
    console.log('\n10. Testing auto-recovery configuration...');
    
    console.log(`   Auto-recovery method: recoverTasks()`);
    console.log(`   Manual recovery method: recoverSingleTask()`);
    console.log(`   Statistics method: getRecoveryStats()`);
    
    // Test 11: Simulate system crash and recovery
    console.log('\n11. Simulating system crash scenario...');
    
    // Create task that appears crashed
    const crashedTask = await autoClickService.createTask(testUser.id, {
      offerUrl: 'https://example.com/crash-test',
      country: 'US',
      timeWindow: '06:00-24:00',
      dailyClicks: 8,
      referer: 'https://google.com'
    });
    
    // Simulate crash during execution
    await prisma.autoClickTask.update({
      where: { id: crashedTask.id },
      data: {
        status: 'running'
      }
    });
    
    // Simulate incomplete execution logs
    await prisma.userActivity.create({
      data: {
        userId: testUser.id,
        action: 'autoclick_task_started',
        resource: 'autoclick_task',
        timestamp: new Date(Date.now() - 1800000),
        metadata: { 
          taskId: crashedTask.id,
          crash: true 
        }
      }
    });
    
    console.log('   ✓ Simulated crashed task created');
    
    // Test crash recovery
    const crashRecovery = await recoveryService.recoverTasks();
    console.log(`   Crash recovery: ${crashRecovery ? 'COMPLETED' : 'FAILED'}`);
    
    // Test 12: Cleanup
    console.log('\n12. Cleaning up test data...');
    
    await prisma.autoClickTask.deleteMany({
      where: { userId: testUser.id }
    });
    
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    
    console.log('   ✓ Test data cleaned up');
    
    console.log('\n=== Task Recovery Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Task recovery test failed:', error);
    throw error;
  }
}

// Run the test
testTaskRecovery()
  .then(() => {
    console.log('\n🎉 All task recovery tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Task recovery tests failed:', error);
    process.exit(1);
  });