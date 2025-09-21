import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMultipleInvitations() {
  try {
    console.log('🧪 测试多人使用同一邀请链接的逻辑...\n');

    // 1. 创建邀请人
    console.log('1. 创建邀请人...');
    const inviter = await prisma.user.upsert({
      where: { email: 'inviter3@test.com' },
      update: {},
      create: {
        email: 'inviter3@test.com',
        name: '邀请人3',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 邀请人: ${inviter.email}`);

    // 2. 创建邀请码
    console.log('\n2. 创建邀请码...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    const invitationResult = await InvitationService.createInvitation(inviter.id);
    console.log(`✅ 邀请码: ${invitationResult.invitationCode}`);

    // 3. 创建第一个被邀请人
    console.log('\n3. 创建第一个被邀请人...');
    const invited1 = await prisma.user.upsert({
      where: { email: 'invited3a@test.com' },
      update: {},
      create: {
        email: 'invited3a@test.com',
        name: '被邀请人3A',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 第一个被邀请人: ${invited1.email}`);

    // 4. 第一个被邀请人使用邀请码
    console.log('\n4. 第一个被邀请人使用邀请码...');
    const acceptResult1 = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited1.id
    );

    if (acceptResult1.success) {
      console.log('✅ 第一次使用成功');
      console.log(`   消息: ${acceptResult1.message}`);
    } else {
      console.error('❌ 第一次使用失败:', acceptResult1.error);
      return;
    }

    // 5. 检查邀请人的订阅（应该获得30天Pro）
    console.log('\n5. 检查邀请人的订阅...');
    const inviterSubscriptions1 = await prisma.subscription.findMany({
      where: { userId: inviter.id },
      include: { plan: true }
    });
    console.log(`   邀请人订阅数量: ${inviterSubscriptions1.length}`);
    inviterSubscriptions1.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status}`);
    });

    // 6. 创建第二个被邀请人
    console.log('\n6. 创建第二个被邀请人...');
    const invited2 = await prisma.user.upsert({
      where: { email: 'invited3b@test.com' },
      update: {},
      create: {
        email: 'invited3b@test.com',
        name: '被邀请人3B',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 第二个被邀请人: ${invited2.email}`);

    // 7. 第二个被邀请人使用同一邀请码
    console.log('\n7. 第二个被邀请人使用同一邀请码...');
    const acceptResult2 = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited2.id
    );

    if (acceptResult2.success) {
      console.log('✅ 第二次使用成功');
      console.log(`   消息: ${acceptResult2.message}`);
    } else {
      console.error('❌ 第二次使用失败:', acceptResult2.error);
      return;
    }

    // 8. 检查邀请人的订阅（应该延长或获得新的Pro订阅）
    console.log('\n8. 再次检查邀请人的订阅...');
    const inviterSubscriptions2 = await prisma.subscription.findMany({
      where: { userId: inviter.id },
      include: { plan: true }
    });
    console.log(`   邀请人订阅数量: ${inviterSubscriptions2.length}`);
    inviterSubscriptions2.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status} (有效期至: ${sub.currentPeriodEnd.toLocaleDateString()})`);
    });

    // 9. 尝试第一个被邀请人重复使用
    console.log('\n9. 测试重复使用...');
    const duplicateResult = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited1.id
    );

    if (duplicateResult.success) {
      console.log('❌ 重复使用不应该成功');
    } else {
      console.log('✅ 重复使用被拒绝');
      console.log(`   错误: ${duplicateResult.error}`);
    }

    // 10. 统计邀请活动记录
    console.log('\n10. 统计邀请活动记录...');
    const allActivities = await prisma.userActivity.findMany({
      where: {
        userId: inviter.id,
        action: 'invitation_accepted'
      },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   总邀请成功次数: ${allActivities.length}`);
    allActivities.forEach(activity => {
      console.log(`   - 被邀请人ID: ${activity.metadata.invitedUserId}, 时间: ${activity.createdAt.toLocaleString()}`);
    });

    console.log('\n🎉 测试完成!');
    console.log('\n💡 预期结果：');
    console.log('   - 邀请码可以被多个不同用户使用');
    console.log('   - 每个用户只能使用同一邀请码一次');
    console.log('   - 邀请人每次成功邀请都获得30天Pro套餐');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testMultipleInvitations().catch(console.error);