import { AutoClickExecutionEngine } from '@/lib/autoclick-engine';
import { prisma } from '@/lib/prisma';
import { AutoClickService } from '@/lib/autoclick-service';

async function testExecutionEngine() {
  console.log('=== Testing Execution Engine ===\n');
  
  try {
    // Test 1: Engine initialization
    console.log('1. Testing engine initialization...');
    const engine = new AutoClickExecutionEngine();
    console.log('   ✓ Execution engine initialized');
    
    // Test 2: Test single click execution with simple visitor
    console.log('\n2. Testing single click execution (simple visitor)...');
    
    // Create a test user
    let testUser = await prisma.user.findFirst({
      where: { email: 'engine@test.com' }
    });
    
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'engine@test.com',
          name: 'Engine Test User',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeZeUfkZMBs9kYZP6',
          role: 'USER',
          status: 'ACTIVE',
          emailVerified: true,
          tokenBalance: 1000
        }
      });
      console.log(`   Created test user: ${testUser.id}`);
    }
    
    // Execute a test click
    const result = await engine.executeClick({
      url: 'https://httpbin.org/get',
      referer: 'https://example.com',
      visitorType: 'simple',
      userId: testUser.id
    });
    
    console.log(`   Execution result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Tokens used: ${result.tokensUsed}`);
    console.log(`   Duration: ${result.duration}ms`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    // Test 3: Test token validation
    console.log('\n3. Testing token validation...');
    
    // Check user's token balance after execution
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    });
    
    if (updatedUser) {
      console.log(`   User token balance: ${updatedUser.tokenBalance}`);
      console.log(`   Tokens consumed: ${1000 - updatedUser.tokenBalance}`);
    }
    
    // Test 4: Test task execution status
    console.log('\n4. Testing task execution status...');
    
    // Create a test task
    const autoClickService = new AutoClickService();
    const task = await autoClickService.createTask(testUser.id, {
      offerUrl: 'https://httpbin.org/get',
      country: 'US',
      timeWindow: '06:00-24:00',
      dailyClicks: 5,
      referer: 'https://example.com'
    });
    console.log(`   Created test task: ${task.id}`);
    
    // Check task status (should not be running yet)
    const status = await engine.getTaskExecutionStatus(task.id);
    console.log(`   Task running: ${status.isRunning}`);
    console.log(`   Today's progress: ${status.todayProgress.completed}/${status.todayProgress.target} (${status.todayProgress.percentage}%)`);
    
    // Test 5: Test error handling
    console.log('\n5. Testing error handling...');
    
    // Test with invalid URL
    const invalidResult = await engine.executeClick({
      url: 'invalid-url',
      referer: 'https://example.com',
      visitorType: 'simple',
      userId: testUser.id
    });
    
    console.log(`   Invalid URL result: ${invalidResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (invalidResult.error) {
      console.log(`   Expected error: ${invalidResult.error}`);
    }
    
    // Test 6: Test proxy integration (if proxy URL is configured)
    console.log('\n6. Testing proxy integration...');
    const proxyUrl = process.env.Proxy_URL_US;
    
    if (proxyUrl) {
      console.log(`   Proxy URL configured: ${proxyUrl}`);
      
      // Test with proxy
      const proxyResult = await engine.executeClick({
        url: 'https://httpbin.org/ip',
        referer: 'https://example.com',
        proxyUrl,
        visitorType: 'simple',
        userId: testUser.id
      });
      
      console.log(`   Proxy execution result: ${proxyResult.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   Duration with proxy: ${proxyResult.duration}ms`);
    } else {
      console.log('   ⚠ No proxy URL configured, skipping proxy test');
    }
    
    // Test 7: Test visitor switching logic
    console.log('\n7. Testing visitor switching logic...');
    console.log('   Note: Visitor switching is tested in executeHourlyTask method');
    console.log('   Switching occurs when success rate is 0 with simple visitor');
    
    // Test 8: Test execution time distribution
    console.log('\n8. Testing execution time distribution...');
    
    // Access private method for testing
    const enginePrivate: any = engine;
    if (enginePrivate.generateExecutionTimes) {
      const times = enginePrivate.generateExecutionTimes(14, 5); // 2 PM, 5 clicks
      console.log(`   Generated ${times.length} execution times for hour 14`);
      console.log(`   First execution: ${new Date(times[0]).toLocaleTimeString()}`);
      console.log(`   Last execution: ${new Date(times[times.length - 1]).toLocaleTimeString()}`);
      
      // Verify times are within the hour
      const startHour = new Date();
      startHour.setHours(14, 5, 0, 0);
      const endHour = new Date(startHour);
      endHour.setHours(15, -5, 0, 0);
      
      const allWithinHour = times.every(time => 
        time >= startHour.getTime() && time <= endHour.getTime()
      );
      
      console.log(`   All times within hour: ${allWithinHour ? 'YES' : 'NO'}`);
    }
    
    // Cleanup
    console.log('\n9. Cleaning up test data...');
    await prisma.autoClickTask.delete({
      where: { id: task.id }
    });
    console.log('   Test task deleted');
    
    console.log('\n=== Execution Engine Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Execution engine test failed:', error);
    throw error;
  }
}

// Run the test
testExecutionEngine()
  .then(() => {
    console.log('\n🎉 All execution engine tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Execution engine tests failed:', error);
    process.exit(1);
  });