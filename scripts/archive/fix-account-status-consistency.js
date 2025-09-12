// 修复用户账户状态不一致问题
// 确保 status 和 isActive 字段保持一致

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAccountStatusConsistency() {
  try {
    console.log('=== 开始修复账户状态一致性 ===\n');

    // 1. 查找所有状态不一致的用户
    const inconsistentUsers = await prisma.user.findMany({
      where: {
        OR: [
          { status: 'ACTIVE', isActive: false },
          { status: 'INACTIVE', isActive: true },
          { status: 'SUSPENDED', isActive: true },
          { status: 'BANNED', isActive: true }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    console.log(`发现 ${inconsistentUsers.length} 个状态不一致的用户:\n`);

    // 2. 显示不一致的用户
    inconsistentUsers.forEach(user => {
      console.log(`- ${user.email} (${user.name || '无名称'})`);
      console.log(`  ID: ${user.id}`);
      console.log(`  status: ${user.status}`);
      console.log(`  isActive: ${user.isActive}`);
      console.log(`  注册时间: ${user.createdAt}`);
      console.log(`  最后登录: ${user.lastLoginAt || '从未登录'}`);
      console.log('');
    });

    if (inconsistentUsers.length === 0) {
      console.log('✅ 所有用户的账户状态都是一致的！');
      return;
    }

    // 3. 确认修复
    console.log('即将修复上述用户的状态不一致问题...');
    console.log('修复规则：');
    console.log('- ACTIVE → isActive = true');
    console.log('- INACTIVE/SUSPENDED/BANNED → isActive = false');
    console.log('');

    // 4. 执行修复
    const fixPromises = inconsistentUsers.map(async (user) => {
      const shouldBeActive = user.status === 'ACTIVE';
      
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: shouldBeActive }
      });
      
      console.log(`✅ 修复用户: ${user.email} (status: ${user.status}, isActive: ${shouldBeActive})`);
      
      return user.id;
    });

    await Promise.all(fixPromises);

    console.log(`\n🎉 成功修复了 ${inconsistentUsers.length} 个用户的账户状态！`);

    // 5. 验证修复结果
    const remainingInconsistent = await prisma.user.count({
      where: {
        OR: [
          { status: 'ACTIVE', isActive: false },
          { status: 'INACTIVE', isActive: true },
          { status: 'SUSPENDED', isActive: true },
          { status: 'BANNED', isActive: true }
        ]
      }
    });

    if (remainingInconsistent === 0) {
      console.log('✅ 验证通过：所有用户状态已一致！');
    } else {
      console.log(`❌ 警告：仍有 ${remainingInconsistent} 个用户状态不一致！`);
    }

  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAccountStatusConsistency()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

export { fixAccountStatusConsistency };