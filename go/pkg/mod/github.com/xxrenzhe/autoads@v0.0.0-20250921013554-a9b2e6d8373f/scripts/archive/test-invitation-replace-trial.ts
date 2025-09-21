import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInvitationWithTrial() {
  try {
    console.log('🧪 测试邀请用户替换试用逻辑...\n');

    // 1. 创建邀请人
    console.log('1. 创建邀请人...');
    const inviter = await prisma.user.upsert({
      where: { email: 'inviter2@test.com' },
      update: {},
      create: {
        email: 'inviter2@test.com',
        name: '邀请人2',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 邀请人: ${inviter.email}`);

    // 2. 创建邀请人的邀请码
    console.log('\n2. 创建邀请码...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    const invitationResult = await InvitationService.createInvitation(inviter.id);
    console.log(`✅ 邀请码: ${invitationResult.invitationCode}`);

    // 3. 创建被邀请人（模拟新用户注册）
    console.log('\n3. 创建被邀请人...');
    const invited = await prisma.user.upsert({
      where: { email: 'invited2@test.com' },
      update: {},
      create: {
        email: 'invited2@test.com',
        name: '被邀请人2',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 被邀请人: ${invited.email}`);

    // 4. 给被邀请人创建14天试用（模拟正常注册流程）
    console.log('\n4. 创建14天试用...');
    const proPlan = await prisma.plan.findFirst({
      where: { name: 'pro', isActive: true }
    });

    if (proPlan) {
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      const trialSubscription = await prisma.subscription.create({
        data: {
          userId: invited.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: trialStartDate,
          currentPeriodEnd: trialEndDate,
          provider: 'system',
          providerSubscriptionId: `trial_${invited.id}_${Date.now()}`
        }
      });

      await prisma.user.update({
        where: { id: invited.id },
        data: {
          subscriptionTokenBalance: proPlan.tokenQuota,
          tokenBalance: proPlan.tokenQuota
        }
      });

      console.log(`✅ 试用创建成功，结束时间: ${trialEndDate.toLocaleDateString()}`);
    }

    // 5. 检查应用前的订阅状态
    console.log('\n5. 应用邀请前的订阅状态...');
    const subscriptionsBefore = await prisma.subscription.findMany({
      where: { userId: invited.id },
      include: { plan: true }
    });
    console.log(`   订阅数量: ${subscriptionsBefore.length}`);
    subscriptionsBefore.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status} (${sub.providerSubscriptionId})`);
    });

    // 6. 应用邀请
    console.log('\n6. 应用邀请...');
    const acceptResult = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited.id
    );

    if (acceptResult.success) {
      console.log('✅ 邀请应用成功');
      console.log(`   消息: ${acceptResult.message}`);
    } else {
      console.error('❌ 邀请应用失败:', acceptResult.error);
      return;
    }

    // 7. 检查应用后的订阅状态
    console.log('\n7. 应用邀请后的订阅状态...');
    const subscriptionsAfter = await prisma.subscription.findMany({
      where: { userId: invited.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   订阅数量: ${subscriptionsAfter.length}`);

    let hasActivePro = false;
    let hasCanceledTrial = false;

    subscriptionsAfter.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status} (${sub.providerSubscriptionId})`);
      console.log(`     有效期至: ${sub.currentPeriodEnd.toLocaleDateString()}`);
      
      if (sub.status === 'ACTIVE' && sub.plan.name === 'pro') {
        hasActivePro = true;
      }
      if (sub.status === 'CANCELED' && sub.providerSubscriptionId?.startsWith('trial_')) {
        hasCanceledTrial = true;
      }
    });

    // 8. 验证结果
    console.log('\n8. 验证结果...');
    if (hasCanceledTrial) {
      console.log('✅ 试用订阅已取消');
    } else {
      console.log('❌ 试用订阅未被取消');
    }

    if (hasActivePro) {
      console.log('✅ Pro订阅已激活');
    } else {
      console.log('❌ Pro订阅未激活');
    }

    // 9. 检查邀请人的订阅
    console.log('\n9. 检查邀请人的订阅...');
    const inviterSubscriptions = await prisma.subscription.findMany({
      where: { userId: inviter.id },
      include: { plan: true }
    });
    console.log(`   邀请人订阅数量: ${inviterSubscriptions.length}`);
    inviterSubscriptions.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status}`);
    });

    console.log('\n🎉 测试完成!');
    console.log('\n💡 预期结果：');
    console.log('   - 被邀请人的14天试用被取消');
    console.log('   - 被邀请人获得30天Pro订阅');
    console.log('   - 邀请人获得30天Pro订阅');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testInvitationWithTrial().catch(console.error);