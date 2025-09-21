import { prisma } from '@/lib/prisma';
import { AutoClickService } from '@/lib/autoclick-service';
import { AutoClickScheduler } from '@/lib/autoclick-scheduler';

async function testSimpleEndToEnd() {
  console.log('=== Simple End-to-End Testing ===\n');
  
  try {
    // Test 1: Create user and task
    console.log('1. Testing user and task creation...');
    
    const timestamp = Date.now();
    const testUser = await prisma.user.create({
      data: {
        email: `simple-e2e-${timestamp}@example.com`,
        name: 'Simple E2E Test User',
        password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 1000
      }
    });
    
    console.log(`   ✓ Created user: ${testUser.id}`);
    
    const autoClickService = new AutoClickService();
    const task = await autoClickService.createTask(testUser.id, {
      offerUrl: 'https://example.com/simple-test',
      country: 'US',
      timeWindow: '06:00-24:00',
      dailyClicks: 10,
      referer: 'https://facebook.com'
    });
    
    console.log(`   ✓ Created task: ${task.id}`);
    
    // Test 2: Start task
    console.log('\n2. Testing task start...');
    
    const startedTask = await autoClickService.startTask(task.id, testUser.id);
    console.log(`   ✓ Task started: ${startedTask.status}`);
    
    // Test 3: Generate daily plan
    console.log('\n3. Testing daily plan generation...');
    
    const scheduler = AutoClickScheduler.getInstance();
    await scheduler['generateTaskDailyPlan'](startedTask);
    console.log('   ✓ Daily plan generated');
    
    // Test 4: Check task progress
    console.log('\n4. Testing task progress...');
    
    const progress = await autoClickService.getTaskProgress(task.id, testUser.id);
    console.log(`   Task progress: ${progress.todayProgress.completed}/${progress.todayProgress.target} (${progress.todayProgress.percentage}%)`);
    
    // Test 5: Get system stats
    console.log('\n5. Testing system statistics...');
    
    const stats = await autoClickService.getSystemStats();
    console.log(`   Total tasks: ${stats.tasks.total}`);
    console.log(`   Running tasks: ${stats.tasks.running}`);
    
    // Test 6: Update task
    console.log('\n6. Testing task update...');
    
    const updatedTask = await autoClickService.updateTask(task.id, testUser.id, {
      dailyClicks: 15
    });
    console.log(`   ✓ Task updated: ${updatedTask.dailyClicks} clicks/day`);
    
    // Test 7: Stop task
    console.log('\n7. Testing task stop...');
    
    const stoppedTask = await autoClickService.stopTask(task.id, testUser.id);
    console.log(`   ✓ Task stopped: ${stoppedTask.status}`);
    
    // Test 8: Delete task
    console.log('\n8. Testing task deletion...');
    
    await autoClickService.deleteTask(task.id, testUser.id);
    console.log('   ✓ Task deleted');
    
    // Verify deletion
    const remainingTasks = await prisma.autoClickTask.count({
      where: { userId: testUser.id }
    });
    console.log(`   Remaining tasks: ${remainingTasks}`);
    
    // Test 9: Cleanup
    console.log('\n9. Cleaning up...');
    
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    console.log('   ✓ User deleted');
    
    console.log('\n=== Simple End-to-End Test Summary ===');
    console.log('✓ User management: CREATE → DELETE');
    console.log('✓ Task lifecycle: CREATE → START → UPDATE → STOP → DELETE');
    console.log('✓ Daily planning: Plan generation successful');
    console.log('✓ Progress tracking: Progress retrieved');
    console.log('✓ System statistics: Stats retrieved');
    console.log('✓ Data consistency: All operations completed');
    
    console.log('\n=== Simple End-to-End Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Simple end-to-end test failed:', error);
    throw error;
  }
}

// Run the test
testSimpleEndToEnd()
  .then(() => {
    console.log('\n🎉 All simple end-to-end tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Simple end-to-end tests failed:', error);
    process.exit(1);
  });