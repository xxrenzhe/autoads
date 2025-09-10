#!/usr/bin/env node

/**
 * API 路由迁移助手
 * 将现有的 API 路由迁移到使用新的 dbPool 和安全中间件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const API_ROUTES_DIR = path.join(__dirname, '../../src/app/api');
const MIGRATED_MARKER = '// MIGRATED_TO_NEW_SYSTEM';

// 迁移规则
const MIGRATION_RULES = {
  // 导入替换
  imports: {
    "from '@/lib/db'": "from '@/lib/db-pool'",
    "import { prisma } from '@/lib/db'": "import { dbPool } from '@/lib/db-pool'",
    "import { createSecureHandler } from '@/lib/utils/api-security'": "import { createAuthHandler, createAdminSecureHandler } from '@/lib/utils/api-route-protection'",
    "import { withConnection, withTransaction } from '@/lib/utils/db-migration-helper'": "import { withConnection, withTransaction } from '@/lib/utils/db-migration-helper'"
  },
  
  // prisma 替换为 withConnection
  prismaUsage: {
    pattern: /await prisma\./g,
    replacement: "await withConnection('operation_name', (prisma) => prisma."
  },
  
  // 处理器模式替换
  handlerPattern: {
    old: /async function handle(\w+)(request: NextRequest, { validatedData, user }: any)/g,
    new: "async function handle$1(request: NextRequest, context: any)\n  const { user } = context;"
  },
  
  // 导出替换
  exports: {
    secureHandler: /export const (GET|POST|PUT|DELETE) = createSecureHandler\({/g,
    authHandler: "export const $1 = createAuthHandler(async (request: NextRequest, context: any) => {\n  return await handle$1(request, context);\n}, {\n  rateLimit: true,\n  requiredPermissions: ['read:own-data']\n});"
  }
};

// 查找所有 API 路由文件
function findApiRoutes(dir) {
  const files = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (item === 'route.ts' && !fs.readFileSync(fullPath, 'utf8').includes(MIGRATED_MARKER)) {
        files.push(fullPath);
      }
    }
  }
  
  scan(dir);
  return files;
}

// 迁移单个文件
function migrateFile(filePath) {
  console.log(`\n🔄 Migrating: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 1. 更新导入
  for (const [oldImport, newImport] of Object.entries(MIGRATION_RULES.imports)) {
    if (content.includes(oldImport)) {
      content = content.replace(oldImport, newImport);
      modified = true;
    }
  }
  
  // 2. 替换 prisma 用法（简单示例，实际需要更复杂的处理）
  if (content.includes('prisma.')) {
    // 查找所有数据库操作
    const dbOperations = content.match(/await prisma\.\w+\.\w+\(/g);
    
    if (dbOperations) {
      console.log('  📊 Found database operations:', dbOperations.length);
      
      // 这里需要更智能的替换逻辑
      // 简单示例：替换查询操作
      content = content.replace(
        /await prisma\.(\w+)\.findUnique\(/g,
        'await withConnection(\'find_$1\', (prisma) => prisma.$1.findUnique('
      );
      
      content = content.replace(
        /await prisma\.(\w+)\.findMany\(/g,
        'await withConnection(\'find_many_$1\', (prisma) => prisma.$1.findMany('
      );
      
      content = content.replace(
        /await prisma\.(\w+)\.create\(/g,
        'await withConnection(\'create_$1\', (prisma) => prisma.$1.create('
      );
      
      content = content.replace(
        /await prisma\.(\w+)\.update\(/g,
        'await withConnection(\'update_$1\', (prisma) => prisma.$1.update('
      );
      
      content = content.replace(
        /await prisma\.(\w+)\.delete\(/g,
        'await withConnection(\'delete_$1\', (prisma) => prisma.$1.delete('
      );
      
      modified = true;
    }
  }
  
  // 3. 更新处理器签名
  content = content.replace(
    MIGRATION_RULES.handlerPattern.old,
    MIGRATION_RULES.handlerPattern.new
  );
  
  // 4. 更新导出
  if (content.includes('createSecureHandler')) {
    content = content.replace(
      MIGRATION_RULES.exports.secureHandler,
      MIGRATION_RULES.exports.authHandler
    );
    modified = true;
  }
  
  // 5. 添加迁移标记
  if (modified) {
    content += `\n\n${MIGRATED_MARKER}`;
    fs.writeFileSync(filePath, content);
    console.log('  ✅ Migration completed');
    return true;
  }
  
  console.log('  ℹ️  No changes needed');
  return false;
}

// 主函数
function main() {
  console.log('🚀 Starting API routes migration...');
  
  const apiRoutes = findApiRoutes(API_ROUTES_DIR);
  console.log(`📁 Found ${apiRoutes.length} API route files to check`);
  
  let migratedCount = 0;
  
  for (const filePath of apiRoutes) {
    if (migrateFile(filePath)) {
      migratedCount++;
    }
  }
  
  console.log(`\n✨ Migration summary:`);
  console.log(`   - Total files checked: ${apiRoutes.length}`);
  console.log(`   - Files migrated: ${migratedCount}`);
  console.log(`   - Files skipped: ${apiRoutes.length - migratedCount}`);
  
  if (migratedCount > 0) {
    console.log('\n⚠️  Please review the migrated files and:');
    console.log('   1. Fix any type errors');
    console.log('   2. Update operation names in withConnection calls');
    console.log('   3. Adjust permissions as needed');
    console.log('   4. Test the routes thoroughly');
  }
}

// 运行迁移
if (require.main === module) {
  main();
}

module.exports = {
  findApiRoutes,
  migrateFile,
  main
};