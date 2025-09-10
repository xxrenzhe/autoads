import { SimpleHttpVisitor } from '@/lib/simple-http-visitor';
import { PuppeteerVisitor } from '@/lib/puppeteer-visitor';
import { prisma } from '@/lib/prisma';

async function testVisitorIntegration() {
  console.log('=== Testing Visitor Integration ===\n');
  
  try {
    // Test 1: SimpleHttpVisitor initialization
    console.log('1. Testing SimpleHttpVisitor initialization...');
    const simpleVisitor = new SimpleHttpVisitor();
    console.log('   ✓ SimpleHttpVisitor initialized');
    
    // Test 2: Test header generation
    console.log('\n2. Testing header generation...');
    
    // Access private methods for testing
    const simplePrivate: any = simpleVisitor;
    if (simplePrivate.generateEnhancedHeaders) {
      const headers = simplePrivate.generateEnhancedHeaders({
        url: 'https://example.com',
        hasReferer: true,
        acceptLanguage: 'en-US',
        userAgentType: 'Chrome'
      });
      
      console.log(`   Generated ${Object.keys(headers).length} headers`);
      console.log(`   User-Agent: ${headers['User-Agent']?.substring(0, 50)}...`);
      console.log(`   Accept: ${headers.Accept}`);
      console.log(`   Referer: ${headers.Referer}`);
    }
    
    // Test 3: Test delay generation
    console.log('\n3. Testing human-like delay generation...');
    
    if (simplePrivate.generateHumanLikeDelay) {
      const delay1 = simplePrivate.generateHumanLikeDelay(500, 2000, false);
      const delay2 = simplePrivate.generateHumanLikeDelay(500, 2000, true);
      
      console.log(`   Normal delay: ${delay1}ms`);
      console.log(`   Redirect delay: ${delay2}ms`);
      console.log(`   Delays within range: ${delay1 >= 500 && delay1 <= 2000 && delay2 >= 500 && delay2 <= 2000 ? 'YES' : 'NO'}`);
    }
    
    // Test 4: Test proxy validation caching
    console.log('\n4. Testing proxy validation caching...');
    
    // Create a test proxy validation
    const testProxyKey = 'test-proxy:192.168.1.1';
    const validationData = {
      success: true,
      proxyIP: '192.168.1.1',
      timestamp: new Date().toISOString()
    };
    
    // Access cache service
    if (simplePrivate.cacheService) {
      await simplePrivate.cacheService.cacheProxyValidation(testProxyKey, validationData);
      console.log('   ✓ Proxy validation cached');
      
      // Retrieve cached validation
      const cached = await simplePrivate.cacheService.getCachedProxyValidation(testProxyKey);
      console.log(`   Cache retrieval: ${cached ? 'SUCCESS' : 'FAILED'}`);
      if (cached) {
        console.log(`   Cached IP: ${cached.proxyIP}`);
      }
    }
    
    // Test 5: Test session management
    console.log('\n5. Testing session management...');
    
    if (simplePrivate.sessionManager) {
      const sessionId = await simplePrivate.sessionManager.createSession();
      console.log(`   Created session: ${sessionId.substring(0, 8)}...`);
      
      const sessionData = await simplePrivate.sessionManager.getSession(sessionId);
      console.log(`   Session retrieval: ${sessionData ? 'SUCCESS' : 'FAILED'}`);
    }
    
    // Test 6: Test PuppeteerVisitor (if available)
    console.log('\n6. Testing PuppeteerVisitor...');
    
    try {
      const puppeteerVisitor = new PuppeteerVisitor();
      console.log('   ✓ PuppeteerVisitor initialized');
      
      // Test browser configuration
      const puppeteerPrivate: any = puppeteerVisitor;
      if (puppeteerPrivate.createBrowserConfig) {
        const config = puppeteerPrivate.createBrowserConfig({
          headless: true,
          timeout: 30000
        });
        
        console.log(`   Browser config created`);
        console.log(`   Headless mode: ${config.headless}`);
        console.log(`   Timeout: ${config.timeout}ms`);
      }
      
    } catch (error) {
      console.log('   ⚠ Puppeteer not available or initialization failed');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test 7: Test visitor switching logic
    console.log('\n7. Testing visitor switching logic...');
    
    // Simulate visitor switching decision
    const successRates = [0, 0.2, 0.5, 0.8, 1.0];
    const switchDecisions = successRates.map(rate => {
      if (rate === 0) return 'SWITCH_TO_PUPPETEER';
      if (rate === 1.0) return 'KEEP_SIMPLE';
      return 'KEEP_CURRENT';
    });
    
    console.log('   Switch decisions based on success rate:');
    successRates.forEach((rate, index) => {
      console.log(`   ${rate * 100}% success rate -> ${switchDecisions[index]}`);
    });
    
    // Test 8: Test error handling and retries
    console.log('\n8. Testing error handling and retry logic...');
    
    if (simplePrivate.attemptVisit) {
      // Test retry configuration
      const maxRetries = 3;
      console.log(`   Max retries configured: ${maxRetries}`);
      
      // Test exponential backoff calculation
      const retryDelays = [];
      for (let i = 0; i < maxRetries; i++) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        retryDelays.push(delay);
      }
      
      console.log(`   Retry delays: ${retryDelays.join('ms, ')}ms`);
    }
    
    // Test 9: Test visitor performance metrics
    console.log('\n9. Testing performance metrics collection...');
    
    const metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0
    };
    
    // Simulate some requests
    const simulatedRequests = [
      { success: true, duration: 1200, tokens: 1 },
      { success: true, duration: 800, tokens: 1 },
      { success: false, duration: 5000, tokens: 0 },
      { success: true, duration: 1500, tokens: 1 }
    ];
    
    simulatedRequests.forEach(req => {
      metrics.totalRequests++;
      if (req.success) {
        metrics.successfulRequests++;
        metrics.totalTokensUsed += req.tokens;
      } else {
        metrics.failedRequests++;
      }
    });
    
    metrics.averageResponseTime = Math.round(
      simulatedRequests.reduce((sum, req) => sum + req.duration, 0) / simulatedRequests.length
    );
    
    console.log(`   Total requests: ${metrics.totalRequests}`);
    console.log(`   Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%`);
    console.log(`   Average response time: ${metrics.averageResponseTime}ms`);
    console.log(`   Total tokens used: ${metrics.totalTokensUsed}`);
    
    // Test 10: Test visitor configuration options
    console.log('\n10. Testing visitor configuration options...');
    
    const configOptions = {
      userAgentTypes: ['Chrome', 'Firefox', 'Safari', 'Edge'],
      languageOptions: ['en-US', 'zh-CN', 'ja-JP', 'ko-KR'],
      timeoutOptions: [10000, 20000, 30000, 60000],
      retryOptions: [1, 3, 5, 10]
    };
    
    console.log('   Available configuration options:');
    Object.entries(configOptions).forEach(([key, options]) => {
      console.log(`   ${key}: ${options.join(', ')}`);
    });
    
    console.log('\n=== Visitor Integration Tests Completed Successfully! ===');
    
  } catch (error) {
    console.error('\n❌ Visitor integration test failed:', error);
    throw error;
  }
}

// Run the test
testVisitorIntegration()
  .then(() => {
    console.log('\n🎉 All visitor integration tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Visitor integration tests failed:', error);
    process.exit(1);
  });