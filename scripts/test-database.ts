import { prisma } from '@/lib/prisma';

async function testDatabaseModels() {
  console.log('=== Testing Database Models ===\n');
  
  try {
    // Test User model
    console.log('1. Testing User model...');
    const userCount = await prisma.user.count();
    console.log(`   ✓ Found ${userCount} users`);
    
    // Test TokenUsage model
    console.log('\n2. Testing TokenUsage model...');
    const tokenUsageCount = await prisma.tokenUsage.count();
    console.log(`   ✓ Found ${tokenUsageCount} token usage records`);
    
    // Test AutoClickTask model
    console.log('\n3. Testing AutoClickTask model...');
    const taskCount = await prisma.autoClickTask.count();
    console.log(`   ✓ Found ${taskCount} AutoClick tasks`);
    
    // Test DailyExecutionPlan model
    console.log('\n4. Testing DailyExecutionPlan model...');
    const planCount = await prisma.dailyExecutionPlan.count();
    console.log(`   ✓ Found ${planCount} daily execution plans`);
    
    // Test HourlyExecution model
    console.log('\n5. Testing HourlyExecution model...');
    const hourlyCount = await prisma.hourlyExecution.count();
    console.log(`   ✓ Found ${hourlyCount} hourly execution records`);
    
    // Test DailySummary model
    console.log('\n6. Testing DailySummary model...');
    const summaryCount = await prisma.dailySummary.count();
    console.log(`   ✓ Found ${summaryCount} daily summaries`);
    
    // Test UserActivity model
    console.log('\n7. Testing UserActivity model...');
    const activityCount = await prisma.userActivity.count();
    console.log(`   ✓ Found ${activityCount} user activity records`);
    
    // Test TokenConfig model
    console.log('\n8. Testing TokenConfig model...');
    const configCount = await prisma.tokenConfig.count();
    console.log(`   ✓ Found ${configCount} token configurations`);
    
    console.log('\n=== All Database Models Test Passed! ===\n');
    
    // Test relationships
    console.log('Testing relationships...\n');
    
    // Get a sample user with their tasks
    const sampleUser = await prisma.user.findFirst({
      include: {
        autoClickTasks: {
          take: 1,
          include: {
            dailyPlans: {
              take: 1,
              include: {
                hourlyExecutions: true
              }
            }
          }
        }
      }
    });
    
    if (sampleUser) {
      console.log(`✓ User-task relationship working for user: ${sampleUser.email}`);
      if (sampleUser.autoClickTasks.length > 0) {
        const task = sampleUser.autoClickTasks[0];
        console.log(`✓ Task-plan relationship working for task: ${task.id}`);
        if (task.dailyPlans.length > 0) {
          const plan = task.dailyPlans[0];
          console.log(`✓ Plan-execution relationship working for plan: ${plan.id}`);
          console.log(`   Plan has ${plan.hourlyExecutions.length} hourly executions`);
        }
      }
    } else {
      console.log('ℹ No users found in database (this is normal for fresh installation)');
    }
    
    console.log('\n=== Database Relationships Test Completed ===');
    
  } catch (error) {
    console.error('Database test failed:', error);
    throw error;
  }
}

// Run the test
testDatabaseModels()
  .then(() => {
    console.log('\n🎉 All database tests passed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database tests failed:', error);
    process.exit(1);
  });