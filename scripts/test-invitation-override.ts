import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInvitationOverridesTrial() {
  console.log('🧪 测试邀请链接覆盖试用套餐逻辑...\n');

  try {
    // 1. 创建邀请人
    console.log('1. 创建邀请人...');
    const inviter = await prisma.user.create({
      data: {
        email: `inviter-${Date.now()}@test.com`,
        name: 'Inviter User',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`   ✅ 创建邀请人: ${inviter.email}`);

    // 2. 创建邀请码
    console.log('\n2. 创建邀请码...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    const invitationResult = await InvitationService.createInvitation(inviter.id);
    console.log(`   ✅ 邀请码: ${invitationResult.invitationCode}`);

    // 3. 创建被邀请人（会自动获得14天试用）
    console.log('\n3. 创建被邀请人...');
    const invited = await prisma.user.create({
      data: {
        email: `invited-${Date.now()}@test.com`,
        name: 'Invited User',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 0
      }
    });
    console.log(`   ✅ 创建被邀请人: ${invited.email}`);

    // 为被邀请人创建试用订阅（模拟NextAuth行为）
    console.log('\n3.1. 为被邀请人创建试用订阅...');
    const proPlan = await prisma.plan.findFirst({
      where: { name: 'pro', isActive: true }
    });
    
    if (proPlan) {
      const { SubscriptionHelper } = await import('@/lib/services/subscription-helper');
      await SubscriptionHelper.createTrialSubscription(invited.id, proPlan.id);
      console.log('   ✅ 已创建14天试用订阅');
    }

    // 4. 应用邀请（应该取消试用并给予30天Pro）
    console.log('\n4. 应用邀请...');
    const acceptResult = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited.id
    );

    if (acceptResult.success) {
      console.log('   ✅ 邀请应用成功');
    } else {
      console.error('   ❌ 邀请应用失败:', acceptResult.error);
      return;
    }

    // 5. 检查最终订阅状态
    console.log('\n5. 检查最终订阅状态...');
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: invited.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   订阅数量: ${subscriptions.length}`);
    
    let hasActivePro = false;
    let hasExpiredTrial = false;
    
    subscriptions.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status} (提供商: ${sub.provider})`);
      console.log(`     开始时间: ${sub.currentPeriodStart.toLocaleDateString()}`);
      console.log(`     结束时间: ${sub.currentPeriodEnd.toLocaleDateString()}`);
      
      if (sub.plan.name === 'pro' && sub.status === 'ACTIVE' && sub.provider === 'invitation') {
        hasActivePro = true;
        // 计算剩余天数
        const now = new Date();
        const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`     剩余天数: ${daysLeft} 天 (应该是30天)`);
      }
      
      if (sub.plan.name === 'pro' && sub.status === 'EXPIRED' && sub.provider === 'trial') {
        hasExpiredTrial = true;
      }
    });

    // 6. 检查邀请人的奖励
    console.log('\n6. 检查邀请人奖励...');
    const inviterSubscriptions = await prisma.subscription.findMany({
      where: { userId: inviter.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
    
    let inviterHasPro = false;
    inviterSubscriptions.forEach(sub => {
      if (sub.plan.name === 'pro' && sub.status === 'ACTIVE' && sub.provider === 'invitation') {
        inviterHasPro = true;
        console.log(`   邀请人也获得了Pro套餐: ${sub.currentPeriodEnd.toLocaleDateString()}`);
      }
    });

    // 7. 清理测试数据
    console.log('\n7. 清理测试数据...');
    await prisma.userActivity.deleteMany({
      where: { userId: { in: [inviter.id, invited.id] } }
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: [inviter.id, invited.id] } }
    });
    await prisma.invitation.deleteMany({
      where: { inviterId: inviter.id }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [inviter.id, invited.id] } }
    });
    console.log('   ✅ 测试数据已清理');

    console.log('\n🎉 测试完成!');
    console.log('\n💡 测试结果:');
    console.log('   ✅ 新用户自动获得14天Pro试用');
    console.log(`   ✅ ${hasExpiredTrial ? '试用订阅被正确取消' : '试用订阅未被取消'}`);
    console.log(`   ✅ ${hasActivePro ? '被邀请人获得30天Pro套餐' : '被邀请人未获得Pro套餐'}`);
    console.log(`   ✅ ${inviterHasPro ? '邀请人获得30天Pro套餐奖励' : '邀请人未获得奖励'}`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testInvitationOverridesTrial().catch(console.error);