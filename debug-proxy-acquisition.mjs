/**
 * Debug Script: 代理获取流程调试
 * 用于诊断静默版本代理获取失败的问题
 */

import { optimizedProxyAcquisitionService } from './src/lib/services/optimized-proxy-acquisition';
import { enhancedProxyPersistenceManager } from './src/lib/services/enhanced-proxy-persistence-manager';
import { createLogger } from './src/lib/utils/security/secure-logger';

const logger = createLogger('ProxyDebug');

async function debugProxyAcquisition() {
  const testProxyUrl = 'http://proxylist.geonode.com/api/proxy-list?limit=1&page=1&sort_by=lastChecked&sort_type=desc';
  const taskId = `debug_${Date.now()}`;
  const requiredProxyCount = 1;
  
  console.log('🔍 开始调试代理获取流程...\n');
  
  try {
    // 1. 检查持久化管理器状态
    console.log('=== 步骤1: 检查持久化管理器状态 ===');
    const stats = enhancedProxyPersistenceManager.getStatistics();
    console.log('当前统计信息:', JSON.stringify(stats, null, 2));
    
    // 2. 初始化持久化管理器
    console.log('\n=== 步骤2: 初始化持久化管理器 ===');
    enhancedProxyPersistenceManager.setProxyUrl(testProxyUrl);
    await enhancedProxyPersistenceManager.initialize();
    console.log('✅ 持久化管理器初始化完成');
    
    // 3. 尝试从缓存获取
    console.log('\n=== 步骤3: 尝试从缓存获取代理 ===');
    const cachedProxies = await enhancedProxyPersistenceManager.getProxies(requiredProxyCount);
    console.log(`缓存中的代理数量: ${cachedProxies.length}`);
    
    if (cachedProxies.length > 0) {
      console.log('缓存代理:', cachedProxies.map(p => `${p.host}:${p.port}`));
    }
    
    // 4. 开始代理获取
    console.log('\n=== 步骤4: 开始优化代理获取 ===');
    console.log('配置:', {
      requiredProxyCount,
      proxyUrl: testProxyUrl,
      taskId,
      maxBatchRetries: 1,
      maxIndividualRetries: 1,
      batchMultiplier: 2,
      enableRedisCache: true,
      requestTimeout: 15000,
      concurrencyLimit: 1
    });
    
    const startTime = Date.now();
    const result = await optimizedProxyAcquisitionService.acquireProxies({
      requiredProxyCount,
      proxyUrl: testProxyUrl,
      taskId,
      maxBatchRetries: 1,
      maxIndividualRetries: 1,
      batchMultiplier: 2,
      enableRedisCache: true,
      requestTimeout: 15000,
      concurrencyLimit: 1
    });
    
    const duration = Date.now() - startTime;
    
    console.log('\n=== 代理获取结果 ===');
    console.log('结果:', JSON.stringify({
      success: result.success,
      strategy: result.strategy,
      proxiesCount: result.proxies.length,
      attempts: result.attempts,
      duration: duration,
      error: result.error,
      stats: result.stats
    }, null, 2));
    
    if (result.proxies.length > 0) {
      console.log('\n获取到的代理:');
      result.proxies.forEach((proxy, index) => {
        console.log(`${index + 1}. ${proxy.host}:${proxy.port} (${proxy.protocol})`);
      });
    }
    
    // 5. 检查持久化管理器最终状态
    console.log('\n=== 步骤5: 检查持久化管理器最终状态 ===');
    const finalStats = enhancedProxyPersistenceManager.getStatistics();
    console.log('最终统计信息:', JSON.stringify(finalStats, null, 2));
    
  } catch (error) {
    console.error('\n❌ 调试过程中发生错误:');
    console.error('错误信息:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('错误堆栈:', error.stack);
    }
  }
}

// 运行调试
debugProxyAcquisition()
  .then(() => {
    console.log('\n🎯 调试完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 调试失败:', error);
    process.exit(1);
  });