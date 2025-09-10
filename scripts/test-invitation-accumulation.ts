import { PrismaClient } from '@prisma/client';
import { InvitationService } from '../src/lib/services/invitation-service';
import { SubscriptionHelper } from '../src/lib/services/subscription-helper';

const prisma = new PrismaClient();

async function testInvitationAccumulation() {
  try {
    console.log('🧪 测试邀请奖励累加功能...\n');

    // 清理测试数据
    await cleanupTestData();

    // 创建邀请者
    const inviter = await createTestUser('inviter@example.com', 'Inviter User');
    console.log(`👤 创建邀请者: ${inviter.email}`);

    // 测试多次邀请的累加效果
    const invitedUsers = [];
    const invitationCodes = [];

    // 第一次邀请
    console.log('\n📝 第一次邀请...');
    const invitation1 = await InvitationService.createInvitation(inviter.id);
    if (invitation1.success && invitation1.invitationCode) {
      invitationCodes.push(invitation1.invitationCode);
      console.log(`   邀请码1: ${invitation1.invitationCode}`);

      const user1 = await createTestUser('user1@example.com', 'User 1');
      invitedUsers.push(user1);

      const result1 = await InvitationService.acceptInvitation(invitation1.invitationCode, user1.id);
      console.log(`   邀请1结果: ${result1.success ? '成功' : '失败'}`);

      // 检查邀请者的订阅状态
      const inviterSub1 = await SubscriptionHelper.getCurrentSubscription(inviter.id);
      if (inviterSub1) {
        const daysRemaining1 = Math.ceil((inviterSub1.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   邀请者订阅状态: ${inviterSub1.plan.name}, 剩余 ${daysRemaining1} 天`);
        console.log(`   订阅结束时间: ${inviterSub1.currentPeriodEnd.toISOString()}`);
      }
    }

    // 第二次邀请
    console.log('\n📝 第二次邀请...');
    const invitation2 = await InvitationService.createInvitation(inviter.id);
    if (invitation2.success && invitation2.invitationCode) {
      invitationCodes.push(invitation2.invitationCode);
      console.log(`   邀请码2: ${invitation2.invitationCode}`);

      const user2 = await createTestUser('user2@example.com', 'User 2');
      invitedUsers.push(user2);

      const result2 = await InvitationService.acceptInvitation(invitation2.invitationCode, user2.id);
      console.log(`   邀请2结果: ${result2.success ? '成功' : '失败'}`);

      // 检查邀请者的订阅状态（应该延长了30天）
      const inviterSub2 = await SubscriptionHelper.getCurrentSubscription(inviter.id);
      if (inviterSub2) {
        const daysRemaining2 = Math.ceil((inviterSub2.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   邀请者订阅状态: ${inviterSub2.plan.name}, 剩余 ${daysRemaining2} 天`);
        console.log(`   订阅结束时间: ${inviterSub2.currentPeriodEnd.toISOString()}`);
      }
    }

    // 第三次邀请
    console.log('\n📝 第三次邀请...');
    const invitation3 = await InvitationService.createInvitation(inviter.id);
    if (invitation3.success && invitation3.invitationCode) {
      invitationCodes.push(invitation3.invitationCode);
      console.log(`   邀请码3: ${invitation3.invitationCode}`);

      const user3 = await createTestUser('user3@example.com', 'User 3');
      invitedUsers.push(user3);

      const result3 = await InvitationService.acceptInvitation(invitation3.invitationCode, user3.id);
      console.log(`   邀请3结果: ${result3.success ? '成功' : '失败'}`);

      // 检查邀请者的订阅状态（应该再延长了30天）
      const inviterSub3 = await SubscriptionHelper.getCurrentSubscription(inviter.id);
      if (inviterSub3) {
        const daysRemaining3 = Math.ceil((inviterSub3.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   邀请者订阅状态: ${inviterSub3.plan.name}, 剩余 ${daysRemaining3} 天`);
        console.log(`   订阅结束时间: ${inviterSub3.currentPeriodEnd.toISOString()}`);
      }
    }

    // 验证累加效果
    console.log('\n📊 验证累加效果...');
    const finalSubscription = await SubscriptionHelper.getCurrentSubscription(inviter.id);
    if (finalSubscription) {
      const totalDays = Math.ceil((finalSubscription.currentPeriodEnd.getTime() - finalSubscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.ceil((finalSubscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`✅ 邀请者最终订阅状态:`);
      console.log(`   套餐: ${finalSubscription.plan.name}`);
      console.log(`   总天数: ${totalDays} 天 (期望: 90天 = 3次邀请 × 30天)`);
      console.log(`   剩余天数: ${remainingDays} 天`);
      console.log(`   开始时间: ${finalSubscription.currentPeriodStart.toISOString()}`);
      console.log(`   结束时间: ${finalSubscription.currentPeriodEnd.toISOString()}`);

      if (totalDays >= 90) {
        console.log('✅ 累加功能验证成功！');
      } else {
        console.log('❌ 累加功能验证失败！');
      }
    }

    // 检查Token累加情况
    console.log('\n💰 检查Token累加情况...');
    const inviterTokens = await prisma.user.findUnique({
      where: { id: inviter.id },
      select: {
        tokenBalance: true,
        purchasedTokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
      }
    });

    if (inviterTokens) {
      const totalTokens = (inviterTokens.tokenBalance || 0) + 
                         (inviterTokens.purchasedTokenBalance || 0) + 
                         (inviterTokens.subscriptionTokenBalance || 0) + 
                         (inviterTokens.activityTokenBalance || 0);
      
      console.log(`   邀请者Token余额:`);
      console.log(`   - 总Token: ${totalTokens}`);
      console.log(`   - 活动Token: ${inviterTokens.activityTokenBalance}`);
      console.log(`   - 订阅Token: ${inviterTokens.subscriptionTokenBalance}`);
      console.log(`   - 传统Token: ${inviterTokens.tokenBalance}`);
    }

    // 检查所有被邀请用户的状态
    console.log('\n👥 检查被邀请用户状态...');
    for (let i = 0; i < invitedUsers.length; i++) {
      const user = invitedUsers[i];
      const userSub = await SubscriptionHelper.getCurrentSubscription(user.id);
      
      if (userSub) {
        const userDays = Math.ceil((userSub.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   用户${i + 1} (${user.email}): ${userSub.plan.name}, 剩余 ${userDays} 天`);
      } else {
        console.log(`   用户${i + 1} (${user.email}): 无活跃订阅`);
      }
    }

    // 检查邀请统计
    console.log('\n📈 检查邀请统计...');
    const invitationStats = await InvitationService.getInvitationStats(inviter.id);
    console.log(`   总邀请数: ${invitationStats.totalInvited}`);
    console.log(`   成功邀请数: ${invitationStats.totalAccepted}`);
    console.log(`   累计Token奖励: ${invitationStats.totalTokensEarned}`);

    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function createTestUser(email: string, name: string) {
  return await prisma.user.create({
    data: {
      email,
      name,
      status: 'ACTIVE',
      role: 'USER',
      emailVerified: true,
      activityTokenBalance: 100,
      tokenBalance: 100
    }
  });
}

async function cleanupTestData() {
  console.log('🧹 清理测试数据...');
  
  const testEmails = [
    'inviter@example.com',
    'user1@example.com', 
    'user2@example.com', 
    'user3@example.com'
  ];
  
  // 删除订阅
  await prisma.subscription.deleteMany({
    where: {
      user: {
        email: {
          in: testEmails
        }
      }
    }
  });

  // 删除Token交易记录
  await prisma.tokenTransaction.deleteMany({
    where: {
      user: {
        email: {
          in: testEmails
        }
      }
    }
  });

  // 删除邀请记录
  await prisma.invitation.deleteMany({
    where: {
      OR: [
        {
          inviter: {
            email: {
              in: testEmails
            }
          }
        },
        {
          invited: {
            email: {
              in: testEmails
            }
          }
        }
      ]
    }
  });

  // 删除审计日志
  await prisma.auditLog.deleteMany({
    where: {
      users: {
        email: {
          in: testEmails
        }
      }
    }
  });

  // 删除用户
  await prisma.user.deleteMany({
    where: {
      email: {
        in: testEmails
      }
    }
  });

  console.log('✅ 测试数据清理完成\n');
}

// 直接运行脚本
testInvitationAccumulation().catch(console.error);

export { testInvitationAccumulation };