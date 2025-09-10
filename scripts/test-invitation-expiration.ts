import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInvitationExpiration() {
  try {
    console.log('🧪 测试邀请订阅过期后回退到免费套餐...\n');

    // 1. 创建邀请人
    console.log('1. 创建邀请人...');
    const inviter = await prisma.user.upsert({
      where: { email: 'inviter-expire@test.com' },
      update: {},
      create: {
        email: 'inviter-expire@test.com',
        name: '邀请人',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });

    // 2. 创建邀请码
    console.log('\n2. 创建邀请码...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    const invitationResult = await InvitationService.createInvitation(inviter.id);
    console.log(`✅ 邀请码: ${invitationResult.invitationCode}`);

    // 3. 创建被邀请人
    console.log('\n3. 创建被邀请人...');
    const invited = await prisma.user.upsert({
      where: { email: 'invited-expire@test.com' },
      update: {},
      create: {
        email: 'invited-expire@test.com',
        name: '被邀请人',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });

    // 4. 应用邀请（获得30天Pro）
    console.log('\n4. 应用邀请...');
    const acceptResult = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited.id
    );

    if (acceptResult.success) {
      console.log('✅ 邀请应用成功');
    } else {
      console.error('❌ 邀请应用失败:', acceptResult.error);
      return;
    }

    // 5. 检查订阅状态
    console.log('\n5. 检查订阅状态...');
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: invited.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   订阅数量: ${subscriptions.length}`);
    subscriptions.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status} (至: ${sub.currentPeriodEnd.toLocaleDateString()})`);
    });

    // 6. 模拟订阅过期（手动设置为过期）
    console.log('\n6. 模拟订阅过期...');
    const proSubscription = subscriptions.find(s => s.plan.name === 'pro');
    if (proSubscription) {
      // 设置过期时间为过去
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      await prisma.subscription.update({
        where: { id: proSubscription.id },
        data: {
          currentPeriodEnd: expiredDate
        }
      });
      console.log('✅ 已设置Pro订阅为过期状态');
    }

    // 7. 处理过期订阅
    console.log('\n7. 处理过期订阅...');
    const { SubscriptionExpirationService } = await import('@/lib/services/subscription-expiration-service');
    const processResults = await SubscriptionExpirationService.processExpiredSubscriptions();
    console.log(`   处理结果: ${processResults.length} 个订阅被处理`);

    // 8. 检查最终状态
    console.log('\n8. 检查最终订阅状态...');
    const finalSubscriptions = await prisma.subscription.findMany({
      where: { userId: invited.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   最终订阅数量: ${finalSubscriptions.length}`);
    finalSubscriptions.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status} (至: ${sub.currentPeriodEnd.toLocaleDateString()})`);
    });

    // 9. 检查用户token余额
    console.log('\n9. 检查用户token余额...');
    const finalUser = await prisma.user.findUnique({
      where: { id: invited.id },
      select: { tokenBalance: true, subscriptionTokenBalance: true }
    });
    console.log(`   Token余额: ${finalUser?.tokenBalance}`);
    console.log(`   订阅Token余额: ${finalUser?.subscriptionTokenBalance}`);

    console.log('\n🎉 测试完成!');
    console.log('\n💡 预期结果：');
    console.log('   - Pro订阅被标记为EXPIRED');
    console.log('   - 自动创建免费套餐订阅');
    console.log('   - 用户token余额调整为免费套餐额度');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testInvitationExpiration().catch(console.error);