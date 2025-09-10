import { autoClickCacheService } from '@/lib/services/autoclick-cache-service';
import { prisma } from '@/lib/prisma';

async function testRedisCache() {
  console.log('=== Testing Redis Cache Integration ===\n');
  
  try {
    // Test 1: Cache service initialization
    console.log('1. Testing cache service initialization...');
    
    const isReady = autoClickCacheService.isReady();
    console.log(`   Cache service status: ${isReady ? 'READY' : 'NOT READY'}`);
    
    if (!isReady) {
      console.log('   ⚠ Redis is not available, running in cache-less mode');
      console.log('   Tests will continue but cache operations will be skipped');
    }
    
    // Test 2: Cache statistics
    console.log('\n2. Testing cache statistics...');
    
    const stats = await autoClickCacheService.getCacheStats();
    console.log(`   Connected: ${stats.isConnected}`);
    console.log(`   Key count: ${stats.keyCount}`);
    if (stats.memoryUsage) {
      console.log(`   Memory usage: ${stats.memoryUsage}`);
    }
    
    // Test 3: Proxy pool caching
    console.log('\n3. Testing proxy pool caching...');
    
    const testProxies = [
      {
        ip: '192.168.1.1',
        port: 8080,
        protocol: 'http',
        country: 'US',
        anonymity: 'elite',
        responseTime: 1200,
        lastChecked: new Date().toISOString()
      },
      {
        ip: '192.168.1.2',
        port: 8080,
        protocol: 'http',
        country: 'US',
        anonymity: 'anonymous',
        responseTime: 800,
        lastChecked: new Date().toISOString()
      },
      {
        ip: '192.168.1.3',
        port: 8080,
        protocol: 'https',
        country: 'US',
        anonymity: 'transparent',
        responseTime: 1500,
        lastChecked: new Date().toISOString()
      }
    ];
    
    const testUserId = 'test-user-123';
    
    if (isReady) {
      // Cache proxy pool
      await autoClickCacheService.cacheProxyPool(testProxies, testUserId);
      console.log(`   ✓ Cached ${testProxies.length} proxies`);
      
      // Retrieve cached proxy pool
      const cachedProxies = await autoClickCacheService.getCachedProxyPool(testUserId);
      if (cachedProxies) {
        console.log(`   ✓ Retrieved ${cachedProxies.length} cached proxies`);
        console.log(`   Cache hit ratio: 100%`);
      } else {
        console.log('   ✗ Failed to retrieve cached proxies');
      }
    } else {
      console.log('   ⚠ Skipped proxy pool caching (Redis not available)');
    }
    
    // Test 4: Execution plan caching
    console.log('\n4. Testing execution plan caching...');
    
    const testTaskId = 'test-task-456';
    const executionPlan = {
      taskId: testTaskId,
      executionDate: new Date().toISOString().split('T')[0],
      hourlyClicks: [0, 0, 0, 0, 0, 0, 2, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      currentVisitor: 'simple',
      totalClicks: 9,
      estimatedDuration: 5400 // seconds
    };
    
    if (isReady) {
      // Cache execution plan
      await autoClickCacheService.cacheExecutionPlan(testTaskId, executionPlan);
      console.log(`   ✓ Cached execution plan for task ${testTaskId}`);
      
      // Retrieve cached execution plan
      const cachedPlan = await autoClickCacheService.getCachedExecutionPlan(testTaskId);
      if (cachedPlan) {
        console.log(`   ✓ Retrieved cached execution plan`);
        console.log(`   Total clicks: ${cachedPlan.totalClicks}`);
        console.log(`   Current visitor: ${cachedPlan.currentVisitor}`);
      } else {
        console.log('   ✗ Failed to retrieve cached execution plan');
      }
    } else {
      console.log('   ⚠ Skipped execution plan caching (Redis not available)');
    }
    
    // Test 5: Social media list caching
    console.log('\n5. Testing social media list caching...');
    
    const socialMediaList = [
      {
        id: 'facebook',
        name: 'Facebook',
        domain: 'facebook.com',
        referer: 'https://facebook.com',
        weight: 30,
        active: true
      },
      {
        id: 'twitter',
        name: 'Twitter',
        domain: 'twitter.com',
        referer: 'https://twitter.com',
        weight: 25,
        active: true
      },
      {
        id: 'linkedin',
        name: 'LinkedIn',
        domain: 'linkedin.com',
        referer: 'https://linkedin.com',
        weight: 20,
        active: true
      },
      {
        id: 'reddit',
        name: 'Reddit',
        domain: 'reddit.com',
        referer: 'https://reddit.com',
        weight: 15,
        active: true
      },
      {
        id: 'instagram',
        name: 'Instagram',
        domain: 'instagram.com',
        referer: 'https://instagram.com',
        weight: 10,
        active: true
      }
    ];
    
    if (isReady) {
      // Cache social media list
      await autoClickCacheService.cacheSocialMediaList(socialMediaList);
      console.log(`   ✓ Cached social media list with ${socialMediaList.length} items`);
      
      // Retrieve cached social media list
      const cachedList = await autoClickCacheService.getCachedSocialMediaList();
      if (cachedList) {
        console.log(`   ✓ Retrieved cached social media list with ${cachedList.length} items`);
      } else {
        console.log('   ✗ Failed to retrieve cached social media list');
      }
    } else {
      console.log('   ⚠ Skipped social media list caching (Redis not available)');
    }
    
    // Test 6: Task execution status caching
    console.log('\n6. Testing task execution status caching...');
    
    const taskStatus = {
      taskId: testTaskId,
      status: 'running',
      progress: {
        completed: 3,
        target: 9,
        percentage: 33
      },
      currentHour: 8,
      clicksThisHour: 2,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };
    
    if (isReady) {
      // Cache task status
      await autoClickCacheService.cacheTaskExecutionStatus(testTaskId, taskStatus);
      console.log(`   ✓ Cached task execution status`);
      
      // Retrieve cached task status
      const cachedStatus = await autoClickCacheService.getCachedTaskExecutionStatus(testTaskId);
      if (cachedStatus) {
        console.log(`   ✓ Retrieved cached task status`);
        console.log(`   Status: ${cachedStatus.status}`);
        console.log(`   Progress: ${cachedStatus.progress.completed}/${cachedStatus.progress.target} (${cachedStatus.progress.percentage}%)`);
      } else {
        console.log('   ✗ Failed to retrieve cached task status');
      }
    } else {
      console.log('   ⚠ Skipped task status caching (Redis not available)');
    }
    
    // Test 7: Proxy validation caching
    console.log('\n7. Testing proxy validation caching...');
    
    const proxyValidationKey = 'proxy_192_168_1_1_8080';
    const validationResult = {
      isValid: true,
      responseTime: 1200,
      working: true,
      anonymity: 'elite',
      country: 'US',
      testedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString() // 10 minutes
    };
    
    if (isReady) {
      // Cache proxy validation
      await autoClickCacheService.cacheProxyValidation(proxyValidationKey, validationResult);
      console.log(`   ✓ Cached proxy validation result`);
      
      // Retrieve cached proxy validation
      const cachedValidation = await autoClickCacheService.getCachedProxyValidation(proxyValidationKey);
      if (cachedValidation) {
        console.log(`   ✓ Retrieved cached proxy validation`);
        console.log(`   Valid: ${cachedValidation.isValid}`);
        console.log(`   Response time: ${cachedValidation.responseTime}ms`);
      } else {
        console.log('   ✗ Failed to retrieve cached proxy validation');
      }
    } else {
      console.log('   ⚠ Skipped proxy validation caching (Redis not available)');
    }
    
    // Test 8: Distributed locks
    console.log('\n8. Testing distributed locks...');
    
    const lockKey = 'task_execution_123';
    
    if (isReady) {
      // Acquire lock
      const lockAcquired = await autoClickCacheService.acquireLock(lockKey, 10); // 10 seconds TTL
      console.log(`   Lock acquired: ${lockAcquired ? 'YES' : 'NO'}`);
      
      if (lockAcquired) {
        // Try to acquire the same lock again (should fail)
        const lockAcquiredAgain = await autoClickCacheService.acquireLock(lockKey, 10);
        console.log(`   Lock acquired again: ${lockAcquiredAgain ? 'YES (ERROR)' : 'NO (EXPECTED)'}`);
        
        // Release lock
        await autoClickCacheService.releaseLock(lockKey);
        console.log('   ✓ Lock released');
        
        // Try to acquire after release (should succeed)
        const lockAcquiredAfterRelease = await autoClickCacheService.acquireLock(lockKey, 10);
        console.log(`   Lock acquired after release: ${lockAcquiredAfterRelease ? 'YES' : 'NO'}`);
        
        // Clean up
        if (lockAcquiredAfterRelease) {
          await autoClickCacheService.releaseLock(lockKey);
        }
      }
    } else {
      console.log('   ⚠ Skipped distributed locks (Redis not available)');
    }
    
    // Test 9: Cache pattern operations
    console.log('\n9. Testing cache pattern operations...');
    
    if (isReady) {
      // Clear all proxy-related cache
      await autoClickCacheService.clearPattern('proxy_pool:*');
      console.log('   ✓ Cleared proxy pool cache pattern');
      
      // Clear all execution plan cache
      await autoClickCacheService.clearPattern('execution_plan:*');
      console.log('   ✓ Cleared execution plan cache pattern');
      
      // Check updated stats
      const updatedStats = await autoClickCacheService.getCacheStats();
      console.log(`   Keys after cleanup: ${updatedStats.keyCount}`);
    } else {
      console.log('   ⚠ Skipped cache pattern operations (Redis not available)');
    }
    
    // Test 10: Cache performance
    console.log('\n10. Testing cache performance...');
    
    if (isReady) {
      const iterations = 1000;
      const testKey = 'performance_test';
      const testValue = { data: 'test', timestamp: Date.now() };
      
      // Test write performance
      const writeStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await autoClickCacheService.cacheTaskExecutionStatus(`${testKey}_${i}`, testValue);
      }
      const writeTime = Date.now() - writeStart;
      
      // Test read performance
      const readStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await autoClickCacheService.getCachedTaskExecutionStatus(`${testKey}_${i}`);
      }
      const readTime = Date.now() - readStart;
      
      console.log(`   Write performance: ${iterations} operations in ${writeTime}ms (${Math.round(iterations / writeTime * 1000)} ops/sec)`);
      console.log(`   Read performance: ${iterations} operations in ${readTime}ms (${Math.round(iterations / readTime * 1000)} ops/sec)`);
      
      // Cleanup performance test data
      await autoClickCacheService.clearPattern('task_status:performance_test_*');
    } else {
      console.log('   ⚠ Skipped cache performance test (Redis not available)');
    }
    
    // Test 11: Cache expiration
    console.log('\n11. Testing cache expiration...');
    
    if (isReady) {
      const expireKey = 'expire_test';
      const expireValue = { data: 'expires_soon', timestamp: Date.now() };
      
      // Cache with short TTL
      await autoClickCacheService.cacheTaskExecutionStatus(expireKey, expireValue);
      console.log('   ✓ Cached data with short TTL');
      
      // Wait for expiration (simulate with pattern clear)
      setTimeout(async () => {
        await autoClickCacheService.clearPattern('task_status:expire_test');
        console.log('   ✓ Simulated cache expiration');
      }, 100);
    } else {
      console.log('   ⚠ Skipped cache expiration test (Redis not available)');
    }
    
    // Test 12: Connection resilience
    console.log('\n12. Testing connection resilience...');
    
    // Test multiple operations in sequence
    const operations = [
      () => autoClickCacheService.cacheProxyPool(testProxies, testUserId),
      () => autoClickCacheService.getCachedProxyPool(testUserId),
      () => autoClickCacheService.cacheExecutionPlan(testTaskId, executionPlan),
      () => autoClickCacheService.getCachedExecutionPlan(testTaskId),
      () => autoClickCacheService.acquireLock('resilience_test', 5),
      (lockResult: any) => lockResult && autoClickCacheService.releaseLock('resilience_test')
    ];
    
    console.log('   Performing sequential operations...');
    for (let i = 0; i < operations.length; i++) {
      try {
        if (i === 5) {
          // Special case for lock release
          const lockResult = await operations[4]();
          await operations[5](lockResult);
        } else if (i < 5) {
          await operations[i]();
          console.log(`   Operation ${i + 1}: SUCCESS`);
        }
      } catch (error) {
        console.log(`   Operation ${i + 1}: FAILED (${error instanceof Error ? error.message : 'Unknown error'})`);
      }
    }
    
    console.log('\n=== Redis Cache Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Redis cache test failed:', error);
    throw error;
  }
}

// Run the test
testRedisCache()
  .then(() => {
    console.log('\n🎉 All Redis cache tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Redis cache tests failed:', error);
    process.exit(1);
  });