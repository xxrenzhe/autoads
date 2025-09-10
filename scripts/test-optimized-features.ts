import { PrismaClient } from '@prisma/client';
import { TrialService } from '../src/lib/services/trial-service';
import { InvitationService } from '../src/lib/services/invitation-service';

const prisma = new PrismaClient();

async function testOptimizedFeatures() {
  try {
    console.log('🧪 开始测试优化后的功能...\n');

    // 清理之前的测试数据
    await cleanupTestData();

    // 测试1: 新用户注册并获得14天试用
    console.log('📋 测试1: 新用户注册和试用期分配');
    const newUser = await createTestUser('test-new-user@example.com', 'New Test User');
    console.log(`✅ 创建新用户: ${newUser.email}`);
    
    // 检查初始token余额
    await logUserTokens('新用户', newUser.id);
    
    // 分配试用期
    console.log('\n🎁 分配14天Pro试用期...');
    const trialResult = await TrialService.assignTrialToNewUser(newUser.id);
    
    if (trialResult) {
      console.log('✅ 试用期分配成功');
      console.log(`   订阅ID: ${trialResult.id}`);
      console.log(`   订阅状态: ${trialResult.status}`);
      console.log(`   到期时间: ${trialResult.currentPeriodEnd}`);
      
      // 检查token是否已添加
      await logUserTokens('获得试用期后', newUser.id);
      
      // 检查订阅详情
      const subscription = await prisma.subscription.findUnique({
        where: { id: trialResult.id },
        include: { plan: true }
      });
      console.log(`   套餐: ${subscription?.plan.name} (Token配额: ${subscription?.plan.tokenQuota})`);
    } else {
      console.log('❌ 试用期分配失败');
    }

    // 测试2: 邀请注册功能
    console.log('\n\n📋 测试2: 邀请注册功能');
    
    // 创建邀请者
    const inviter = await createTestUser('test-inviter@example.com', 'Inviter User');
    console.log(`✅ 创建邀请者: ${inviter.email}`);
    
    // 创建被邀请者
    const invitee = await createTestUser('test-invitee@example.com', 'Invitee User');
    console.log(`✅ 创建被邀请者: ${invitee.email}`);
    
    // 记录初始token状态
    console.log('\n💰 初始Token状态:');
    await logUserTokens('邀请者', inviter.id);
    await logUserTokens('被邀请者', invitee.id);
    
    // 创建邀请
    console.log('\n📝 创建邀请...');
    const invitation = await InvitationService.createInvitation(inviter.id);
    
    if (invitation.success && invitation.invitationCode) {
      console.log(`✅ 邀请创建成功: ${invitation.invitationCode}`);
      
      // 接受邀请
      console.log('\n✅ 接受邀请...');
      const acceptResult = await InvitationService.acceptInvitation(invitation.invitationCode, invitee.id);
      
      if (acceptResult.success) {
        console.log(`✅ 邀请接受成功: ${acceptResult.message}`);
        
        // 检查邀请后的token状态
        console.log('\n💰 邀请后Token状态:');
        await logUserTokens('邀请者', inviter.id);
        await logUserTokens('被邀请者', invitee.id);
        
        // 检查订阅状态
        console.log('\n📋 订阅状态:');
        await logUserSubscriptions('邀请者', inviter.id);
        await logUserSubscriptions('被邀请者', invitee.id);
        
        // 验证没有获得活动token（只有订阅token）
        const inviterAfter = await prisma.user.findUnique({ where: { id: inviter.id } });
        const inviteeAfter = await prisma.user.findUnique({ where: { id: invitee.id } });
        
        console.log('\n🔍 验证Token类型:');
        console.log(`   邀请者活动Token: ${inviterAfter?.activityTokenBalance || 0} (应该是0)`);
        console.log(`   邀请者订阅Token: ${inviterAfter?.subscriptionTokenBalance || 0} (应该是10000)`);
        console.log(`   被邀请者活动Token: ${inviteeAfter?.activityTokenBalance || 0} (应该是0)`);
        console.log(`   被邀请者订阅Token: ${inviteeAfter?.subscriptionTokenBalance || 0} (应该是10000)`);
        
      } else {
        console.log(`❌ 邀请接受失败: ${acceptResult.error}`);
      }
    } else {
      console.log(`❌ 邀请创建失败: ${invitation.error}`);
    }

    // 测试3: 检查metadata字段
    console.log('\n\n📋 测试3: 订阅metadata字段');
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true }
    });
    
    console.log(`📊 找到 ${subscriptions.length} 个活跃订阅:`);
    for (const sub of subscriptions) {
      console.log(`   - ${sub.id}: ${sub.plan.name}, metadata:`, sub.metadata || 'null');
    }

    console.log('\n✅ 所有测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 辅助函数
async function createTestUser(email: string, name: string) {
  return await prisma.user.create({
    data: {
      email,
      name,
      status: 'ACTIVE',
      emailVerified: true,
      tokenBalance: 0,
      subscriptionTokenBalance: 0,
      activityTokenBalance: 0,
      purchasedTokenBalance: 0
    }
  });
}

async function logUserTokens(label: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tokenBalance: true,
      subscriptionTokenBalance: true,
      activityTokenBalance: true,
      purchasedTokenBalance: true
    }
  });
  
  if (user) {
    // Calculate total token balance
    // Use the new detailed balances if available, otherwise fall back to legacy tokenBalance
    const newBalanceTotal = (user.subscriptionTokenBalance || 0) + 
                           (user.activityTokenBalance || 0) + 
                           (user.purchasedTokenBalance || 0);
    const total = newBalanceTotal > 0 ? newBalanceTotal : (user.tokenBalance || 0);
    
    console.log(`   ${label}:`);
    console.log(`     - 总Token: ${total}`);
    console.log(`     - 订阅Token: ${user.subscriptionTokenBalance || 0}`);
    console.log(`     - 活动Token: ${user.activityTokenBalance || 0}`);
    console.log(`     - 购买Token: ${user.purchasedTokenBalance || 0}`);
    console.log(`     - 兼容Token: ${user.tokenBalance || 0}`);
  }
}

async function logUserSubscriptions(label: string, userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
    orderBy: { currentPeriodEnd: 'desc' }
  });
  
  console.log(`   ${label}的订阅:`);
  if (subscriptions.length > 0) {
    for (const sub of subscriptions) {
      console.log(`     - ${sub.plan.name}: ${sub.currentPeriodStart.toLocaleDateString()} 至 ${sub.currentPeriodEnd.toLocaleDateString()}`);
    }
  } else {
    console.log('     无活跃订阅');
  }
}

async function cleanupTestData() {
  // 删除测试用户
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'test-new-user@example.com',
          'test-inviter@example.com',
          'test-invitee@example.com'
        ]
      }
    }
  });
  
  // 删除相关邀请
  await prisma.invitation.deleteMany({
    where: {
      OR: [
        { inviter: { email: 'test-inviter@example.com' } },
        { email: 'test-invitee@example.com' }
      ]
    }
  });
  
  console.log('🧹 清理测试数据完成');
}

// 运行测试
testOptimizedFeatures();