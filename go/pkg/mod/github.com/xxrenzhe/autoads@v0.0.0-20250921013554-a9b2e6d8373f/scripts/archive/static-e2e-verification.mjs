#!/usr/bin/env node

/**
 * 静态E2E验证脚本
 * 通过检查文件结构和API路由定义来验证系统完整性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

console.log('🔍 开始静态E2E验证...');
console.log('');

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

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

// 检查文件是否存在
function checkFileExists(filePath) {
  return fs.existsSync(path.join(rootDir, filePath));
}

// 检查目录是否存在
function checkDirExists(dirPath) {
  return fs.existsSync(path.join(rootDir, dirPath)) && 
         fs.statSync(path.join(rootDir, dirPath)).isDirectory();
}

// 检查API路由文件的基本结构
function checkApiRoute(apiPath) {
  const fullPath = path.join(rootDir, 'src/app/api', apiPath, 'route.ts');
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    // 检查是否导出了HTTP方法
    return content.includes('export ') && 
           (content.includes('GET') || content.includes('POST') || 
            content.includes('PUT') || content.includes('DELETE'));
  } catch (error) {
    return false;
  }
}

console.log('=== 1. 项目结构检查 ===');

// 检查关键目录
recordTest('src目录存在', checkDirExists('src'));
recordTest('app目录存在', checkDirExists('src/app'));
recordTest('api目录存在', checkDirExists('src/app/api'));
recordTest('public目录存在', checkDirExists('public'));

console.log('\n=== 2. 核心功能API检查 ===');

// BatchOpen功能
recordTest('BatchOpen API目录存在', checkDirExists('src/app/api/batchopen'));
recordTest('BatchOpen silent-start路由存在', checkApiRoute('batchopen/silent-start'));
recordTest('BatchOpen task路由存在', checkApiRoute('batchopen/task/[taskId]'));
recordTest('BatchOpen progress路由存在', checkApiRoute('batchopen/silent-progress'));

// SiteRank功能
recordTest('SiteRank API目录存在', checkDirExists('src/app/api/siterank'));
recordTest('SiteRank rank路由存在', checkApiRoute('siterank/rank'));

// ChangeLink功能（使用enhanced-example作为代表）
recordTest('ChangeLink API目录存在', checkDirExists('src/app/api/enhanced-example'));
recordTest('ChangeLink路由存在', checkApiRoute('enhanced-example'));

console.log('\n=== 3. 管理员功能检查 ===');

recordTest('管理员API目录存在', checkDirExists('src/app/api/admin'));
recordTest('用户管理API存在', checkApiRoute('admin/users'));
recordTest('订阅管理API存在', checkApiRoute('admin/subscriptions'));
recordTest('仪表板统计API存在', checkApiRoute('admin/dashboard/stats'));

console.log('\n=== 4. 认证系统检查 ===');

recordTest('认证API目录存在', checkDirExists('src/app/api/auth'));
recordTest('NextAuth配置存在', checkFileExists('src/lib/auth/v5-config.ts'));
recordTest('中间件配置存在', checkFileExists('middleware.ts'));

console.log('\n=== 5. 数据库配置检查 ===');

recordTest('Prisma schema存在', checkFileExists('prisma/schema.prisma'));
recordTest('数据库种子文件存在', checkFileExists('prisma/seed.ts'));
recordTest('Prisma客户端配置存在', checkFileExists('src/lib/prisma.ts'));

console.log('\n=== 6. 测试框架检查 ===');

recordTest('Jest配置存在', checkFileExists('jest.config.cjs'));
recordTest('Playwright配置存在', checkFileExists('playwright.config.ts'));
recordTest('单元测试目录存在', checkDirExists('__tests__'));
recordTest('E2E测试目录存在', checkDirExists('e2e'));

console.log('\n=== 7. 部署配置检查 ===');

recordTest('Dockerfile存在', checkFileExists('Dockerfile'));
recordTest('Docker Compose配置存在', checkFileExists('docker-compose.yml'));
recordTest('环境变量示例存在', checkFileExists('env.example'));

console.log('\n=== 8. 核心服务文件检查 ===');

// 检查核心服务文件
const coreServices = [
  'src/lib/silent-batch-task-manager.ts',
  'src/lib/siterank/similarweb-service.ts',
  'src/lib/enhanced-playwright-service.ts',
  'src/lib/services/task-execution-service.ts',
  'src/lib/services/proxy-service.ts'
];

coreServices.forEach(service => {
  if (service.includes('*')) {
    // 处理通配符
    const dir = path.dirname(service);
    const pattern = path.basename(service);
    if (checkDirExists(dir)) {
      const files = fs.readdirSync(path.join(rootDir, dir));
      const matched = files.some(f => f.includes(pattern.replace('*', '')));
      recordTest(`${service} 存在`, matched);
    } else {
      recordTest(`${service} 存在`, false);
    }
  } else {
    recordTest(`${service} 存在`, checkFileExists(service));
  }
});

// 输出测试总结
console.log('\n' + '='.repeat(50));
console.log('📊 静态E2E验证结果总结');
console.log('='.repeat(50));
console.log(`总检查项: ${results.total}`);
console.log(`通过: ${results.passed} ✅`);
console.log(`失败: ${results.failed} ❌`);
console.log(`通过率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

// 生成建议
console.log('\n💡 建议:');
if (results.failed === 0) {
  console.log('✅ 系统结构完整，所有核心功能文件都存在。');
  console.log('✅ 可以继续进行部署流程。');
} else {
  console.log('⚠️  发现缺失的文件，请检查以下项目:');
  results.tests.filter(t => !t.passed).forEach(test => {
    console.log(`   - ${test.name}: ${test.details}`);
  });
}

// 退出码
process.exit(results.failed === 0 ? 0 : 1);