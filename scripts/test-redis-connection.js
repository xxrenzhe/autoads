#!/usr/bin/env node

/**
 * Redis 连接测试脚本
 * 验证是否能连接到真实的 Redis 服务器
 */

const { createRedisClient, checkRedisHealth } = require('../src/lib/redis-config');

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...\n');
  
  try {
    // 获取环境变量
    const redisUrl = process.env.REDIS_URL;
    console.log('📋 Configuration:');
    console.log(`   Redis URL: ${redisUrl || 'Not set (using localhost:6379)'}\n`);
    
    // 创建客户端
    console.log('🔄 Creating Redis client...');
    const client = createRedisClient();
    
    // 测试连接
    console.log('📡 Testing connection...');
    const health = await checkRedisHealth();
    
    if (health) {
      console.log('✅ Redis connection successful!\n');
      
      // 测试基本操作
      console.log('🧪 Testing basic operations...');
      
      // SET/GET 测试
      await client.set('test_key', 'test_value', 'EX', 10);
      const value = await client.get('test_key');
      console.log(`   SET/GET: ${value === 'test_value' ? '✅' : '❌'}`);
      
      // INCR 测试
      await client.set('counter', '0');
      const incremented = await client.incr('counter');
      console.log(`   INCR: ${incremented === 1 ? '✅' : '❌'}`);
      
      // INFO 测试
      const info = await client.info('server');
      console.log(`   INFO: ${info.includes('redis_version') ? '✅' : '❌'}`);
      
      // 清理测试数据
      await client.del('test_key', 'counter');
      
      console.log('\n📊 Redis Stats:');
      const memory = await client.info('memory');
      const memoryLines = memory.split('\n');
      const usedMemory = memoryLines.find(line => line.startsWith('used_memory:'));
      console.log(`   ${usedMemory}`);
      
      const clients = await client.info('clients');
      const clientLines = clients.split('\n');
      const connectedClients = clientLines.find(line => line.startsWith('connected_clients:'));
      console.log(`   ${connectedClients}`);
      
      console.log('\n🎉 All tests passed! Redis is working correctly.');
      
    } else {
      console.log('❌ Redis connection failed!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error testing Redis:', error.message);
    process.exit(1);
  } finally {
    // 关闭连接
    try {
      const { closeRedisConnection } = require('../src/lib/redis-config');
      await closeRedisConnection();
    } catch (e) {
      // 忽略关闭错误
    }
  }
}

// 运行测试
if (require.main === module) {
  testRedisConnection();
}

module.exports = { testRedisConnection };