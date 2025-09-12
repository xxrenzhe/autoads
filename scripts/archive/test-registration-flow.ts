import { PrismaClient } from '@prisma/client';
import { TrialService } from '../src/lib/services/trial-service';
import { InvitationService } from '../src/lib/services/invitation-service';
import { SubscriptionHelper } from '../src/lib/services/subscription-helper';

const prisma = new PrismaClient();

async function testRegistrationFlow() {
  try {
    console.log('🧪 测试新用户注册流程...\n');

    // 清理测试数据
    await cleanupTestData();

    // 测试1: 普通注册（应该获得14天试用）
    console.log('📝 测试1: 普通用户注册（14天试用）');
    const testUser1 = await createTestUser('test1@example.com', 'Test User 1');
    
    const trial = await TrialService.assignTrialToNewUser(testUser1.id);
    if (trial) {
      console.log(`✅ 试用期创建成功: ${trial.plan.name}, 结束时间: ${trial.currentPeriodEnd.toISOString()}`);
      
      const trialStatus = await TrialService.getTrialStatus(testUser1.id);
      console.log(`   试用状态: ${trialStatus.isActive ? '激活' : '未激活'}, 剩余天数: ${trialStatus.daysRemaining}`);
    } else {
      console.log('❌ 试用期创建失败');
    }
    console.log();

    // 测试2: 通过邀请注册（应该获得30天Pro套餐）
    console.log('📝 测试2: 通过邀请注册（30天Pro套餐）');
    
    // 创建邀请者
    const inviter = await createTestUser('inviter@example.com', 'Inviter User');
    const invitationResult = await InvitationService.createInvitation(inviter.id);
    
    if (invitationResult.success && invitationResult.invitationCode) {
      console.log(`   邀请码创建成功: ${invitationResult.invitationCode}`);
      
      // 创建被邀请用户
      const testUser2 = await createTestUser('test2@example.com', 'Test User 2');
      
      // 接受邀请
      const acceptResult = await InvitationService.acceptInvitation(invitationResult.invitationCode, testUser2.id);
      
      if (acceptResult.success) {
        console.log(`✅ 邀请接受成功: ${acceptResult.message}`);
        
        // 检查两个用户的订阅状态
        const inviterSub = await SubscriptionHelper.getCurrentSubscription(inviter.id);
        const inviteeSub = await SubscriptionHelper.getCurrentSubscription(testUser2.id);
        
        console.log(`   邀请者订阅: ${inviterSub?.plan.name || '无'}, 结束时间: ${inviterSub?.currentPeriodEnd.toISOString() || 'N/A'}`);
        console.log(`   被邀请者订阅: ${inviteeSub?.plan.name || '无'}, 结束时间: ${inviteeSub?.currentPeriodEnd.toISOString() || 'N/A'}`);
      } else {
        console.log(`❌ 邀请接受失败: ${acceptResult.error}`);
      }
    } else {
      console.log(`❌ 邀请码创建失败: ${invitationResult.error}`);
    }
    console.log();

    // 测试3: 检查Token余额
    console.log('📝 测试3: 检查用户Token余额');
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['test1@example.com', 'test2@example.com', 'inviter@example.com']
        }
      },
      select: {
        email: true,
        tokenBalance: true,
        purchasedTokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
      }
    });

    users.forEach(user => {
      const totalTokens = (user.tokenBalance || 0) + 
                         (user.purchasedTokenBalance || 0) + 
                         (user.subscriptionTokenBalance || 0) + 
                         (user.activityTokenBalance || 0);
      console.log(`   ${user.email}: 总Token ${totalTokens} (活动: ${user.activityTokenBalance}, 订阅: ${user.subscriptionTokenBalance})`);
    });
    console.log();

    // 测试4: 检查订阅状态
    console.log('📝 测试4: 检查所有订阅状态');
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: {
          in: [testUser1.id, inviter.id]
        }
      },
      include: {
        plan: true,
        user: {
          select: { email: true }
        }
      }
    });

    subscriptions.forEach(sub => {
      const daysRemaining = Math.ceil((sub.currentPeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      console.log(`   ${sub.user.email}: ${sub.plan.name} (${sub.provider}), 剩余 ${daysRemaining} 天`);
    });
    console.log();

    // 测试5: 验证业务逻辑
    console.log('📝 测试5: 验证业务逻辑');
    
    // 验证普通用户获得14天试用
    const user1Sub = await SubscriptionHelper.getCurrentSubscription(testUser1.id);
    if (user1Sub && user1Sub.provider === 'trial') {
      const trialDays = Math.ceil((user1Sub.currentPeriodEnd.getTime() - user1Sub.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`✅ 普通用户试用期验证: ${trialDays} 天 (期望: 14天)`);
    } else {
      console.log('❌ 普通用户试用期验证失败');
    }

    // 验证邀请用户获得30天Pro
    const inviterSub = await SubscriptionHelper.getCurrentSubscription(inviter.id);
    if (inviterSub && inviterSub.provider === 'invitation') {
      const invitationDays = Math.ceil((inviterSub.currentPeriodEnd.getTime() - inviterSub.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`✅ 邀请用户Pro套餐验证: ${invitationDays} 天 (期望: 30天)`);
    } else {
      console.log('❌ 邀请用户Pro套餐验证失败');
    }

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
  
  // 删除测试用户的相关数据
  const testEmails = ['test1@example.com', 'test2@example.com', 'inviter@example.com'];
  
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
testRegistrationFlow().catch(console.error);

export { testRegistrationFlow };