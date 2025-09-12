import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUserTokens() {
  try {
    console.log('🔧 开始修复用户Token问题...\n');
    
    const userEmail = 'yj2008ay611@gmail.com';
    
    // 查找问题用户
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        tokenBalance: true,
        purchasedTokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        tokenUsedThisMonth: true,
        createdAt: true,
        lastLoginAt: true,
        loginCount: true
      }
    });

    if (!user) {
      console.log(`❌ 未找到用户: ${userEmail}`);
      return;
    }

    console.log(`👤 修复用户: ${user.email}`);
    console.log(`   当前状态: ${user.status}`);
    
    const currentTotal = (user.tokenBalance || 0) + 
                        (user.purchasedTokenBalance || 0) + 
                        (user.subscriptionTokenBalance || 0) + 
                        (user.activityTokenBalance || 0);
    console.log(`   当前总Token: ${currentTotal}`);
    console.log();

    // 执行修复操作
    const fixes = [];
    
    // 1. 确保账户状态为ACTIVE
    if (user.status !== 'ACTIVE') {
      fixes.push('激活账户状态');
    }
    
    // 2. 如果Token余额为0，给予初始Token
    if (currentTotal === 0) {
      fixes.push('添加初始活动Token (100个)');
    }

    if (fixes.length === 0) {
      console.log('✅ 用户账户无需修复');
      return;
    }

    console.log('🔧 执行修复操作:');
    fixes.forEach((fix, index) => {
      console.log(`   ${index + 1}. ${fix}`);
    });
    console.log();

    // 使用事务执行所有修复操作
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      
      // 修复账户状态
      if (user.status !== 'ACTIVE') {
        updateData.status = 'ACTIVE';
      }
      
      // 添加初始Token
      if (currentTotal === 0) {
        updateData.activityTokenBalance = 100;
        updateData.tokenBalance = { increment: 100 }; // 也更新传统字段以保持兼容性
      }

      // 更新用户数据
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          status: true,
          tokenBalance: true,
          purchasedTokenBalance: true,
          subscriptionTokenBalance: true,
          activityTokenBalance: true,
        }
      });

      // 如果添加了Token，创建交易记录
      if (currentTotal === 0) {
        const newTotal = (updatedUser.tokenBalance || 0) + 
                        (updatedUser.purchasedTokenBalance || 0) + 
                        (updatedUser.subscriptionTokenBalance || 0) + 
                        (updatedUser.activityTokenBalance || 0);

        await tx.tokenTransaction.create({
          data: {
            userId: user.id,
            type: 'CREDIT',
            amount: 100,
            balanceBefore: currentTotal,
            balanceAfter: newTotal,
            source: 'system_fix',
            description: '系统修复 - 新用户初始Token奖励',
            metadata: {
              reason: 'user_account_fix',
              fixedBy: 'system',
              fixedAt: new Date().toISOString(),
              originalIssue: 'zero_token_balance',
              userEmail: user.email
            }
          }
        });
      }

      return updatedUser;
    });

    console.log('✅ 修复完成！');
    console.log();
    console.log('📊 修复后的用户状态:');
    console.log(`   邮箱: ${result.email}`);
    console.log(`   状态: ${result.status}`);
    console.log(`   传统Token: ${result.tokenBalance || 0}`);
    console.log(`   购买Token: ${result.purchasedTokenBalance || 0}`);
    console.log(`   订阅Token: ${result.subscriptionTokenBalance || 0}`);
    console.log(`   活动Token: ${result.activityTokenBalance || 0}`);
    
    const newTotal = (result.tokenBalance || 0) + 
                    (result.purchasedTokenBalance || 0) + 
                    (result.subscriptionTokenBalance || 0) + 
                    (result.activityTokenBalance || 0);
    console.log(`   总Token余额: ${newTotal}`);
    console.log();

    // 验证修复结果
    console.log('🔍 验证修复结果...');
    const verification = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        status: true,
        tokenBalance: true,
        purchasedTokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
      }
    });

    if (verification) {
      const verifyTotal = (verification.tokenBalance || 0) + 
                         (verification.purchasedTokenBalance || 0) + 
                         (verification.subscriptionTokenBalance || 0) + 
                         (verification.activityTokenBalance || 0);
      
      if (verification.status === 'ACTIVE' && verifyTotal > 0) {
        console.log('✅ 验证通过 - 用户账户已成功修复');
      } else {
        console.log('❌ 验证失败 - 修复可能未完全成功');
      }
    }

    // 检查Token交易记录
    const transactionCount = await prisma.tokenTransaction.count({
      where: { userId: user.id }
    });
    console.log(`📝 用户Token交易记录数: ${transactionCount}`);

  } catch (error) {
    console.error('❌ 修复用户Token时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 直接运行脚本
fixUserTokens().catch(console.error);

export { fixUserTokens };