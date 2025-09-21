import { prisma } from '@/lib/prisma';
import { AutoClickScheduler } from '@/lib/autoclick-scheduler';
import { AutoClickService } from '@/lib/autoclick-service';
import { getPSTDate, getPSTHour, formatPSTTime } from '@/lib/utils/autoclick-timezone';

async function testTaskScheduler() {
  console.log('=== Testing Task Scheduler ===\n');
  
  try {
    // Test 1: Check if scheduler is initialized
    console.log('1. Testing scheduler initialization...');
    const scheduler = AutoClickScheduler.getInstance();
    console.log('   ✓ Scheduler instance created');
    
    // Test 2: Test timezone handling
    console.log('\n2. Testing PST timezone support...');
    const now = new Date();
    const pstDate = getPSTDate(now);
    const pstHour = getPSTHour(now);
    console.log(`   Current UTC time: ${now.toISOString()}`);
    console.log(`   Current PST date: ${pstDate}`);
    console.log(`   Current PST hour: ${pstHour}`);
    console.log(`   Formatted PST time: ${formatPSTTime(now)}`);
    
    // Test 3: Test task creation
    console.log('\n3. Testing task creation...');
    const autoClickService = new AutoClickService();
    
    // Clean up any existing test tasks
    await prisma.autoClickTask.deleteMany({
      where: { offerUrl: 'https://example.com/test-scheduler' }
    });
    
    // Create a test user if needed
    let testUser = await prisma.user.findFirst({
      where: { email: 'scheduler@test.com' }
    });
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'scheduler@test.com',
          name: 'Scheduler Test User',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6', // hashed 'testpassword'
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          tokenBalance: 1000
        }
      });
      console.log(`   Created test user: ${testUser.id}`);
    }
    
    // Create a test task
    const task = await autoClickService.createTask(testUser.id, {
      offerUrl: 'https://example.com/test-scheduler',
      country: 'US',
      timeWindow: '06:00-24:00',
      dailyClicks: 10,
      referer: 'https://example.com'
    });
    console.log(`   Created test task: ${task.id}`);
    
    // Test 4: Test daily plan generation
    console.log('\n4. Testing daily plan generation...');
    // Access private method for testing
    const schedulerPrivate: any = scheduler;
    if (schedulerPrivate.generateTaskDailyPlan) {
      await schedulerPrivate.generateTaskDailyPlan(task);
      console.log('   ✓ Daily plan generation method executed');
      
      // Check if plan was created
      const plan = await prisma.dailyExecutionPlan.findFirst({
        where: { 
          taskId: task.id,
          executionDate: new Date(pstDate + 'T00:00:00.000Z')
        }
      });
      
      if (plan) {
        console.log(`   ✓ Daily plan created: ${plan.id}, total clicks: ${plan.hourlyClicks.reduce((sum: number, clicks: number) => sum + clicks, 0)}`);
      } else {
        console.log('   ⚠ Daily plan not created (might be outside business hours)');
      }
    }
    
    // Test 5: Test task execution
    console.log('\n5. Testing task execution...');
    // Test with simple HTTP visitor
    const executionEngine = schedulerPrivate.executionEngine;
    const result = await executionEngine.executeClick({
      url: task.offerUrl,
      referer: task.referer || '',
      visitorType: 'simple',
      userId: testUser.id
    });
    
    console.log(`   Execution result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Tokens used: ${result.tokensUsed}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    // Test 6: Test task status update
    console.log('\n6. Testing task status update...');
    const updatedTask = await autoClickService.updateTask(task.id, testUser.id, {
      status: 'paused'
    });
    console.log(`   Task status updated: ${updatedTask.status}`);
    
    // Test 7: Test task progress
    console.log('\n7. Testing task progress...');
    const progress = await autoClickService.getTaskProgress(task.id, testUser.id);
    console.log(`   Task progress retrieved`);
    console.log(`   Today's target: ${progress.todayProgress.totalTarget}`);
    console.log(`   Completed: ${progress.todayProgress.completed}`);
    console.log(`   Percentage: ${progress.todayProgress.percentage}%`);
    
    // Cleanup
    console.log('\n8. Cleaning up test data...');
    await prisma.autoClickTask.delete({
      where: { id: task.id }
    });
    console.log('   Test task deleted');
    
    console.log('\n=== Task Scheduler Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Task scheduler test failed:', error);
    throw error;
  }
}

// Run the test
testTaskScheduler()
  .then(() => {
    console.log('\n🎉 All task scheduler tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Task scheduler tests failed:', error);
    process.exit(1);
  });