#!/usr/bin/env node

// Test script for scheduled task service
import fetch from 'node-fetch';

async function testScheduledTaskService() {
  console.log('🧪 测试定时任务服务...\n');

  try {
    // Test 1: Check if the API endpoint exists
    console.log('1. 测试API端点...');
    const response = await fetch('http://localhost:3000/api/scheduled-tasks');
    
    if (response.status === 404) {
      console.log('   ❌ API端点未找到 (404)');
      console.log('   这可能是因为:');
      console.log('   - 开发服务器未正确启动');
      console.log('   - API路由文件有问题');
      console.log('   - 需要重新构建项目');
      return;
    }
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('   ✅ API端点响应正常');
    
    // Test 2: Check tasks
    console.log('\n2. 检查定时任务...');
    if (data.success && data.data) {
      console.log(`   已注册 ${data.data.length} 个任务:`);
      data.data.forEach(task => {
        console.log(`   - ${task.name}: ${task.enabled ? '启用' : '禁用'}`);
      });
    }

    // Test 3: Trigger a task
    console.log('\n3. 测试触发任务...');
    const triggerResponse = await fetch('http://localhost:3000/api/scheduled-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger', taskId: 'subscription-expiration' })
    });

    if (triggerResponse.ok) {
      console.log('   ✅ 任务触发成功');
    } else {
      console.log('   ⚠️  任务触发失败 (可能任务不存在)');
    }

    console.log('\n🎉 测试完成!');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log('\n💡 确保开发服务器正在运行:');
    console.log('   npm run dev');
  }
}

testScheduledTaskService();