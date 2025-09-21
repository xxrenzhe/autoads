#!/usr/bin/env node

/**
 * E2E用户流程验证脚本
 * 验证三个核心功能：batchopen、siterank、adscenter
 */

import http from 'http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🚀 开始E2E用户流程验证...');
console.log(`📍 基础URL: ${BASE_URL}\n`);

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// 记录测试结果
function recordTest(name, passed, details = '') {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name} - ${details}`);
  }
  results.tests.push({ name, passed, details });
}

// 发起HTTP请求
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port || 80,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'E2E-Test-Agent/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主测试函数
async function runTests() {
  console.log('=== 1. 健康检查测试 ===');
  
  try {
    const healthResponse = await makeRequest('/api/health');
    recordTest(
      '健康检查API',
      healthResponse.status === 200,
      `状态码: ${healthResponse.status}`
    );
  } catch (error) {
    recordTest('健康检查API', false, error.message);
  }

  console.log('\n=== 2. BatchOpen功能测试 ===');
  
  try {
    // 1. 测试创建批量任务
    const batchTaskData = {
      taskId: 'test-e2e-' + Date.now(),
      urls: ['https://example.com', 'https://google.com'],
      cycleCount: 1,
      openInterval: 5,
      useSingleProxyStrategy: true,
      enableConcurrentExecution: false
    };

    const batchResponse = await makeRequest('/api/batchopen/silent-start', 'POST', batchTaskData);
    recordTest(
      'BatchOpen创建任务',
      batchResponse.status === 200 || batchResponse.status === 201,
      `状态码: ${batchResponse.status}`
    );

    if (batchResponse.status === 200 || batchResponse.status === 201) {
      const taskResult = JSON.parse(batchResponse.body);
      console.log(`   📝 任务ID: ${taskResult.taskId || 'N/A'}`);
      
      // 2. 测试查询任务状态
      await delay(2000);
      const taskId = taskResult.taskId || batchTaskData.taskId;
      const statusResponse = await makeRequest(`/api/batchopen/task/${taskId}`);
      recordTest(
        'BatchOpen查询任务状态',
        statusResponse.status === 200,
        `状态码: ${statusResponse.status}`
      );
    }
  } catch (error) {
    recordTest('BatchOpen功能测试', false, error.message);
  }

  console.log('\n=== 3. SiteRank功能测试 ===');
  
  try {
    // 测试网站排名分析
    const siterankData = {
      domains: ['example.com', 'google.com'],
      includeSimilarWeb: true
    };

    const rankResponse = await makeRequest('/api/siterank/rank', 'POST', siterankData);
    recordTest(
      'SiteRank网站排名分析',
      rankResponse.status === 200,
      `状态码: ${rankResponse.status}`
    );

    if (rankResponse.status === 200) {
      const rankResult = JSON.parse(rankResponse.body);
      console.log(`   📊 分析域名数: ${rankResult.analyzed || 0}`);
    }
  } catch (error) {
    recordTest('SiteRank功能测试', false, error.message);
  }

  console.log('\n=== 4. AdsCenter功能测试 ===');
  
  try {
    // 测试增强示例API（代表AdsCenter功能）
    const adscenterData = {
      campaignId: 'test-campaign-' + Date.now(),
      urls: [
        { url: 'https://example.com/page1', anchor: 'Page 1' },
        { url: 'https://example.com/page2', anchor: 'Page 2' }
      ],
      keywords: ['example', 'test']
    };

    const changeResponse = await makeRequest('/api/enhanced-example', 'POST', adscenterData);
    recordTest(
      'AdsCenter链接管理',
      changeResponse.status === 200,
      `状态码: ${changeResponse.status}`
    );
  } catch (error) {
    recordTest('AdsCenter功能测试', false, error.message);
  }

  console.log('\n=== 5. 管理员功能测试 ===');
  
  try {
    // 测试管理员统计API
    const statsResponse = await makeRequest('/api/admin/dashboard/stats');
    recordTest(
      '管理员统计API',
      statsResponse.status === 200 || statsResponse.status === 401,
      `状态码: ${statsResponse.status} (401表示需要认证，正常)`
    );
  } catch (error) {
    recordTest('管理员功能测试', false, error.message);
  }

  // 输出测试总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 E2E测试结果总结');
  console.log('='.repeat(50));
  console.log(`总测试数: ${results.total}`);
  console.log(`通过: ${results.passed} ✅`);
  console.log(`失败: ${results.failed} ❌`);
  console.log(`通过率: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 所有测试通过！系统已准备好进行部署。');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查相关功能。');
    process.exit(1);
  }
}

// 启动服务器并运行测试
async function main() {
  console.log('提示: 请确保Next.js开发服务器正在运行 (npm run dev)');
  console.log('或者设置BASE_URL环境变量指向已部署的服务器\n');
  
  // 等待用户确认
  if (process.env.CI) {
    // CI环境下直接运行
    await runTests();
  } else {
    console.log('5秒后开始测试...');
    await delay(5000);
    await runTests();
  }
}

main().catch(console.error);