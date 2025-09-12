import { PrismaClient } from '@prisma/client';
import { InvitationService } from '../src/lib/services/invitation-service';
import { SubscriptionHelper } from '../src/lib/services/subscription-helper';

const prisma = new PrismaClient();

async function testInvitationWithoutExtraTokens() {
  try {
    console.log('🧪 测试移除额外Token后的邀请功能...\n');

    // 清理测试数据
    await cleanupTestData();

    // 创建邀请者
    const inviter = await createTestUser('inviter@example.com', 'Inviter User');
    console.log(`👤 创建邀请者: ${inviter.email}`);

    // 创建被邀请者
    const invitee = await createTestUser('invitee@example.com', 'Invitee User');
    console.log(`👤 创建被邀请者: ${invitee.email}`);

    // 记录初始Token状态
    console.log('\n💰 初始Token状态:');
    await logUserTokens('邀请者', inviter.id);
    await logUserTokens('被邀请者', invitee.id);

    // 创建邀请
    console.log('\n📝 创建邀请...');
    const invitation = await InvitationService.createInvitation(inviter.id);
    
    if (invitation.success && invitation.invitationCode) {
      console.log(`   邀请码: ${invitation.invitationCode}`);

      // 接受邀请
      console.log('\n✅ 接受邀请...');
      const result = await InvitationService.acceptInvitation(invitation.invitationCode, invitee.id);
      
      if (result.success) {
        console.log(`   结果: ${result.message}`);

        // 检查邀请后的Token状态
        console.log('\n💰 邀请后Token状态:');
        await logUserTokens('邀请者', inviter.id);
        await logUserTokens('被邀请者', invitee.id);

        // 检查订阅状态
        console.log('\n📋 订阅状态:');
        const inviterSub = await SubscriptionHelper.getCurrentSubscription(inviter.id);
        const inviteeSub = await SubscriptionHelper.getCurrentSubscription(invitee.id);

        if (inviterSub) {
          const inviterDays = Math.ceil((inviterSub.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          console.log(`   邀请者: ${inviterSub.plan.name}, 剩余 ${inviterDays} 天`);
        } else {
          console.log('   邀请者: 无活跃订阅');
        }

        if (inviteeSub) {
          const inviteeDays = Math.ceil((inviteeSub.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          console.log(`   被邀请者: ${inviteeSub.plan.name}, 剩余 ${inviteeDays} 天`);
        } else {
          console.log('   被邀请者: 无活跃订阅');
        }

        // 检查Token交易记录
        console.log('\n📝 Token交易记录:');
        const inviterTransactions = await prisma.tokenTransaction.findMany({
          where: { userId: inviter.id },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        const inviteeTransactions = await prisma.tokenTransaction.findMany({
          where: { userId: invitee.id },
          orderBy: { createdAt: 'desc' },
          take: 5
        });

        console.log(`   邀请者交易记录 (${inviterTransactions.length} 条):`);
        inviterTransactions.forEach(tx => {
          console.log(`     ${tx.type}: ${tx.amount} tokens (${tx.source}) - ${tx.description}`);
        });

        console.log(`   被邀请者交易记录 (${inviteeTransactions.length} 条):`);
        inviteeTransactions.forEach(tx => {
          console.log(`     ${tx.type}: ${tx.amount} tokens (${tx.source}) - ${tx.description}`);
        });

        // 验证结果
        console.log('\n🔍 验证结果:');
        
        // 检查是否有额外的推荐Token
        const inviterReferralTokens = inviterTransactions.filter(tx => tx.type === 'REFERRAL' || tx.source.includes('invitation_reward'));
        const inviteeReferralTokens = inviteeTransactions.filter(tx => tx.type === 'BONUS' || tx.source.includes('invitation_accept'));

        if (inviterReferralTokens.length === 0 && inviteeReferralTokens.length === 0) {
          console.log('✅ 确认: 没有额外的推荐Token奖励');
        } else {
          console.log('❌ 警告: 仍然存在额外的Token奖励');
          console.log('   邀请者推荐Token:', inviterReferralTokens);
          console.log('   被邀请者推荐Token:', inviteeReferralTokens);
        }

        // 检查订阅Token
        const inviterSubTokens = inviterTransactions.filter(tx => tx.type === 'SUBSCRIPTION' || tx.source.includes('subscription'));
        const inviteeSubTokens = inviteeTransactions.filter(tx => tx.type === 'SUBSCRIPTION' || tx.source.includes('subscription'));

        console.log(`✅ 邀请者订阅Token: ${inviterSubTokens.length > 0 ? '有' : '无'}`);
        console.log(`✅ 被邀请者订阅Token: ${inviteeSubTokens.length > 0 ? '有' : '无'}`);

      } else {
        console.log(`❌ 邀请接受失败: ${result.error}`);
      }
    } else {
      console.log(`❌ 邀请创建失败: ${invitation.error}`);
    }

    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function logUserTokens(userType: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      tokenBalance: true,
      purchasedTokenBalance: true,
      subscriptionTokenBalance: true,
      activityTokenBalance: true,
    }
  });

  if (user) {
    const totalTokens = (user.tokenBalance || 0) + 
                       (user.purchasedTokenBalance || 0) + 
                       (user.subscriptionTokenBalance || 0) + 
                       (user.activityTokenBalance || 0);
    
    console.log(`   ${userType} (${user.email}):`);
    console.log(`     总Token: ${totalTokens}`);
    console.log(`     - 活动Token: ${user.activityTokenBalance || 0}`);
    console.log(`     - 订阅Token: ${user.subscriptionTokenBalance || 0}`);
    console.log(`     - 购买Token: ${user.purchasedTokenBalance || 0}`);
    console.log(`     - 传统Token: ${user.tokenBalance || 0}`);
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
  
  const testEmails = ['inviter@example.com', 'invitee@example.com'];
  
  // 获取测试用户ID
  const testUsers = await prisma.user.findMany({
    where: {
      email: {
        in: testEmails
      }
    },
    select: { id: true }
  });
  
  const testUserIds = testUsers.map(user => user.id);
  
  if (testUserIds.length > 0) {
    // 删除订阅
    await prisma.subscription.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });

    // 删除Token交易记录
    await prisma.tokenTransaction.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });

    // 删除邀请记录
    await prisma.invitation.deleteMany({
      where: {
        OR: [
          {
            inviterId: {
              in: testUserIds
            }
          },
          {
            invitedId: {
              in: testUserIds
            }
          }
        ]
      }
    });

    // 删除审计日志
    await prisma.auditLog.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });

    // 删除用户活动记录
    await prisma.userActivity.deleteMany({
      where: {
        userId: {
          in: testUserIds
        }
      }
    });
  }

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
testInvitationWithoutExtraTokens().catch(console.error);

export { testInvitationWithoutExtraTokens };