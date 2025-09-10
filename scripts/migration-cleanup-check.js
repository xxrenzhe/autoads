// 迁移后代码清理脚本
// 帮助找到所有需要更新的代码引用

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * 查找所有使用 isActive 的文件
 */
function findIsActiveUsage() {
  console.log('=== 查找所有使用 isActive 的代码 ===\n');
  
  try {
    // 查找 TypeScript/JavaScript 文件中的使用
    const tsFiles = execSync('find src -name "*.ts" -o -name "*.tsx" | head -20', { 
      encoding: 'utf8',
      cwd: process.cwd()
    }).split('\n').filter(Boolean);
    
    let totalUsages = 0;
    
    tsFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        const usages = lines
          .map((line, index) => {
            if (line.includes('.isActive') || line.includes('isActive:')) {
              return {
                line: index + 1,
                content: line.trim()
              };
            }
            return null;
          })
          .filter(Boolean);
        
        if (usages.length > 0) {
          console.log(`\n📄 ${file}:`);
          usages.forEach(usage => {
            console.log(`  ${usage.line}: ${usage.content}`);
            totalUsages++;
          });
        }
      } catch (error) {
        // 忽略读取错误
      }
    });
    
    console.log(`\n📊 总计发现 ${totalUsages} 处使用 isActive 的代码`);
    
  } catch (error) {
    console.error('查找失败:', error);
  }
}

/**
 * 查找 Prisma schema 中的 isActive 字段
 */
function checkPrismaSchema() {
  console.log('\n=== 检查 Prisma Schema ===\n');
  
  try {
    const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf8');
    
    if (content.includes('isActive')) {
      console.log('❌ Prisma schema 中仍包含 isActive 字段');
      console.log('请运行数据库迁移以移除该字段');
    } else {
      console.log('✅ Prisma schema 中已移除 isActive 字段');
    }
  } catch (error) {
    console.error('检查 Prisma schema 失败:', error);
  }
}

/**
 * 检查类型定义
 */
function checkTypeDefinitions() {
  console.log('\n=== 检查类型定义 ===\n');
  
  const filesToCheck = [
    'src/types/auth.ts',
    'src/types/user.ts',
    'src/types/index.ts'
  ];
  
  filesToCheck.forEach(file => {
    try {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('isActive')) {
          console.log(`⚠️  ${file} 中包含 isActive 类型定义`);
        }
      }
    } catch (error) {
      // 忽略文件不存在的错误
    }
  });
}

/**
 * 生成迁移报告
 */
function generateMigrationReport() {
  console.log('\n=== 迁移报告 ===\n');
  
  console.log('已完成的项目：');
  console.log('✅ 1. 创建了统一的状态判断工具 (src/lib/utils/account-status.ts)');
  console.log('✅ 2. 修复了现有数据的不一致问题');
  console.log('✅ 3. 更新了核心组件中的状态判断逻辑');
  console.log('✅ 4. 创建了数据库迁移脚本');
  
  console.log('\n待完成的项目：');
  console.log('⏳ 1. 运行数据库迁移以移除 isActive 字段');
  console.log('⏳ 2. 更新所有剩余使用 isActive 的代码');
  console.log('⏳ 3. 更新类型定义文件');
  console.log('⏳ 4. 测试所有功能确保正常运行');
  
  console.log('\n建议的迁移步骤：');
  console.log('1. 在低峰期运行数据库迁移');
  console.log('2. 逐个组件更新，使用 getAccountStatus() 替代直接使用 isActive');
  console.log('3. 更新管理员界面，移除 isActive 编辑选项');
  console.log('4. 运行完整测试套件');
}

// 主函数
function main() {
  findIsActiveUsage();
  checkPrismaSchema();
  checkTypeDefinitions();
  generateMigrationReport();
}

// 运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}