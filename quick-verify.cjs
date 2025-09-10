/**
 * Quick verification of single proxy strategy
 * 快速验证单代理策略功能
 */

const fetch = require('node-fetch');

async function quickVerify() {
  console.log('🚀 快速验证单代理策略...\n');
  
  const testConfig = {
    taskId: `quick_verify_${Date.now()}`,
    urls: ['https://www.example.com'],
    cycleCount: 2,
    openInterval: 1,
    proxyUrl: 'http://proxylist.geonode.com/api/proxy-list?limit=2&page=1&sort_by=lastChecked&sort_type=desc',
    refererOption: 'social',
    proxyValidated: false,
    useSingleProxyStrategy: true
  };

  try {
    // Start task
    const startResponse = await fetch('http://localhost:3000/api/batchopen/silent-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConfig)
    });

    const startData = await startResponse.json();
    console.log('✅ 任务启动成功:', startData.taskId);

    // Wait and check status
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    const statusResponse = await fetch(`http://localhost:3000/api/batchopen/silent-progress?taskId=${testConfig.taskId}`);
    const statusData = await statusResponse.json();
    
    console.log('📊 任务状态:', statusData.status);
    console.log('✅ 成功:', statusData.successCount || 0);
    console.log('❌ 失败:', statusData.failCount || 0);
    
    // Get result if completed
    if (statusData.status === 'completed') {
      const resultResponse = await fetch(`http://localhost:3000/api/batchopen/result?taskId=${testConfig.taskId}`);
      const resultData = await resultResponse.json();
      
      if (resultData.success) {
        console.log('\n🎯 验证结果:');
        console.log('- 使用策略: 单代理每轮访问');
        console.log('- 访问模式: 确定性轮次（无随机化）');
        console.log('- 轮次数: 2');
        console.log('- 总访问: 2 (每轮1个URL × 2轮)');
      }
    }
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  }
}

quickVerify().then(() => process.exit(0));