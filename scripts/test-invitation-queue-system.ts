import { PrismaClient } from '@prisma/client';
import { InvitationService } from '../src/lib/services/invitation-service';
import { SubscriptionHelper } from '../src/lib/services/subscription-helper';

const prisma = new PrismaClient();

async function testInvitationQueueSystem() {
  try {
    console.log('🧪 测试邀请奖励队列系统...\n');

    // 清理测试数据
    await cleanupTestData();

    // 创建邀请者（已有活跃订阅）
    const inviter = await createTestUser('inviter-with-sub@example.com', 'Inviter With Sub');
    console.log(`👤 创建邀请者: ${inviter.email}`);

    // 为邀请者创建一个活跃的付费订阅（持续60天）
    const activeSubscription = await createActiveSubscription(inviter.id, 60);
    console.log(`📋 为邀请者创建60天活跃订阅`);

    // 创建被邀请者1
    const invitee1 = await createTestUser('invitee1@example.com', 'Invitee 1');
    console.log(`👤 创建被邀请者1: ${invitee1.email}`);

    // 创建被邀请者2
    const invitee2 = await createTestUser('invitee2@example.com', 'Invitee 2');
    console.log(`👤 创建被邀请者2: ${invitee2.email}`);

    // 记录初始状态
    console.log('\n💰 初始状态:');
    await logUserStatus('邀请者', inviter.id);
    await logUserStatus('被邀请者1', invitee1.id);
    await logUserStatus('被邀请者2', invitee2.id);

    // 创建邀请
    console.log('\n📝 创建邀请...');
    const invitation = await InvitationService.createInvitation(inviter.id);
    
    if (invitation.success && invitation.invitationCode) {
      console.log(`   邀请码: ${invitation.invitationCode}`);

      // 第一个被邀请者接受邀请
      console.log('\n✅ 被邀请者1接受邀请...');
      const result1 = await InvitationService.acceptInvitation(invitation.invitationCode, invitee1.id);
      
      if (result1.success) {
        console.log(`   结果: ${result1.message}`);

        // 检查邀请后的状态
        console.log('\n📋 第一次邀请后状态:');
        await logUserStatus('邀请者', inviter.id);
        await logUserStatus('被邀请者1', invitee1.id);

        // 检查队列状态
        console.log('\n📊 队列状态:');
        const inviterQueued = await InvitationService.getQueuedRewards(inviter.id);
        const invitee1Queued = await InvitationService.getQueuedRewards(invitee1.id);
        
        console.log(`   邀请者队列: ${inviterQueued.pending.length} 个待处理奖励 (${inviterQueued.totalDays} 天)`);
        console.log(`   被邀请者1队列: ${invitee1Queued.pending.length} 个待处理奖励 (${invitee1Queued.totalDays} 天)`);
      }

      // 第二个被邀请者使用相同的邀请码
      console.log('\n✅ 被邀请者2接受邀请...');
      const result2 = await InvitationService.acceptInvitation(invitation.invitationCode, invitee2.id);
      
      if (result2.success) {
        console.log(`   结果: ${result2.message}`);

        // 检查最终队列状态
        console.log('\n📊 最终队列状态:');
        const finalInviterQueued = await InvitationService.getQueuedRewards(inviter.id);
        const finalInvitee1Queued = await InvitationService.getQueuedRewards(invitee1.id);
        const finalInvitee2Queued = await InvitationService.getQueuedRewards(invitee2.id);
        
        console.log(`   邀请者队列: ${finalInviterQueued.pending.length} 个待处理奖励 (${finalInviterQueued.totalDays} 天)`);
        console.log(`   被邀请者1队列: ${finalInvitee1Queued.pending.length} 个待处理奖励 (${finalInvitee1Queued.totalDays} 天)`);
        console.log(`   被邀请者2队列: ${finalInvitee2Queued.pending.length} 个待处理奖励 (${finalInvitee2Queued.totalDays} 天)`);

        // 验证业务逻辑
        console.log('\n🔍 验证业务逻辑:');
        
        // 邀请者应该有2个30天的奖励在队列中（总共60天）
        if (finalInviterQueued.totalDays === 60) {
          console.log('✅ 邀请者: 60天Pro套餐已正确排队');
        } else {
          console.log(`❌ 邀请者: 期望60天，实际${finalInviterQueued.totalDays}天`);
        }

        // 被邀请者应该各有1个30天的奖励
        if (finalInvitee1Queued.totalDays === 30 && finalInvitee2Queued.totalDays === 30) {
          console.log('✅ 被邀请者: 各有30天Pro套餐已正确排队');
        } else {
          console.log(`❌ 被邀请者: 期望30天，实际分别为${finalInvitee1Queued.totalDays}天和${finalInvitee2Queued.totalDays}天`);
        }

        // 测试队列处理（模拟当前订阅过期）
        console.log('\n🔄 测试队列处理（模拟当前订阅过期）...');
        
        // 过期当前订阅
        await expireSubscription(activeSubscription.id);
        
        // 处理队列奖励
        const processedInviter = await SubscriptionHelper.processQueuedInvitationRewards(inviter.id);
        const processedInvitee1 = await SubscriptionHelper.processQueuedInvitationRewards(invitee1.id);
        const processedInvitee2 = await SubscriptionHelper.processQueuedInvitationRewards(invitee2.id);

        // 检查处理后的状态
        console.log('\n📋 队列处理后状态:');
        await logUserStatus('邀请者', inviter.id);
        await logUserStatus('被邀请者1', invitee1.id);
        await logUserStatus('被邀请者2', invitee2.id);

        // 验证最终结果
        console.log('\n🎯 最终验证:');
        
        const inviterSub = await SubscriptionHelper.getCurrentSubscription(inviter.id);
        const invitee1Sub = await SubscriptionHelper.getCurrentSubscription(invitee1.id);
        const invitee2Sub = await SubscriptionHelper.getCurrentSubscription(invitee2.id);

        if (inviterSub) {
          const days = Math.ceil((inviterSub.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          console.log(`   邀请者: ${days}天Pro订阅 ✅`);
        }

        if (invitee1Sub) {
          const days = Math.ceil((invitee1Sub.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          console.log(`   被邀请者1: ${days}天Pro订阅 ✅`);
        }

        if (invitee2Sub) {
          const days = Math.ceil((invitee2Sub.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          console.log(`   被邀请者2: ${days}天Pro订阅 ✅`);
        }

        // 检查Token分配
        console.log('\n💰 Token分配验证:');
        await logUserTokens('邀请者', inviter.id);
        await logUserTokens('被邀请者1', invitee1.id);
        await logUserTokens('被邀请者2', invitee2.id);
      }
    }

    console.log('\n🎉 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function logUserStatus(userType: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      tokenBalance: true
    }
  });

  const subscription = await SubscriptionHelper.getCurrentSubscription(userId);
  const queuedRewards = await InvitationService.getQueuedRewards(userId);

  console.log(`   ${userType} (${user?.email}):`);
  console.log(`     Token余额: ${user?.tokenBalance || 0}`);
  
  if (subscription) {
    const days = Math.ceil((subscription.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    console.log(`     活跃订阅: ${subscription.plan.name} (剩余${days}天)`);
  } else {
    console.log(`     活跃订阅: 无`);
  }

  if (queuedRewards.pending.length > 0) {
    console.log(`     队列奖励: ${queuedRewards.pending.length}个 (${queuedRewards.totalDays}天)`);
  } else {
    console.log(`     队列奖励: 无`);
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

async function createActiveSubscription(userId: string, days: number) {
  const proPlan = await prisma.plan.findFirst({
    where: {
      name: { contains: 'PRO', mode: 'insensitive' },
      isActive: true
    }
  });

  if (!proPlan) {
    throw new Error('Pro plan not found');
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return await prisma.subscription.create({
    data: {
      userId,
      planId: proPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      provider: 'stripe',
      providerSubscriptionId: `test_sub_${userId}`,
      source: 'STRIPE'
    }
  });
}

async function expireSubscription(subscriptionId: string) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'EXPIRED',
      currentPeriodEnd: new Date()
    }
  });
}

async function cleanupTestData() {
  console.log('🧹 清理测试数据...');
  
  const testEmails = ['inviter-with-sub@example.com', 'invitee1@example.com', 'invitee2@example.com'];
  
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

    // 删除队列奖励
    await prisma.queuedInvitationReward.deleteMany({
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
testInvitationQueueSystem().catch(console.error);

export { testInvitationQueueSystem };