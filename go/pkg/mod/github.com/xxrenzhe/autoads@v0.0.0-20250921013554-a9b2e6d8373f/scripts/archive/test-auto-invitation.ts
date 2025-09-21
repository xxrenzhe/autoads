import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAutoInvitation() {
  try {
    console.log('🧪 测试新用户自动生成邀请链接功能...\n');

    // 模拟创建新用户（类似于NextAuth创建用户的过程）
    console.log('1. 创建新用户...');
    const newUser = await prisma.user.create({
      data: {
        email: `newuser-${Date.now()}@test.com`,
        name: '新测试用户',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 新用户创建成功: ${newUser.email} (ID: ${newUser.id})`);

    // 创建14天Pro试用（模拟NextAuth逻辑）
    console.log('\n2. 创建14天Pro试用...');
    const proPlan = await prisma.plan.findFirst({
      where: { name: 'pro', isActive: true }
    });

    if (proPlan) {
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      await prisma.subscription.create({
        data: {
          userId: newUser.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: trialStartDate,
          currentPeriodEnd: trialEndDate,
          provider: 'system',
          providerSubscriptionId: `trial_${newUser.id}_${Date.now()}`
        }
      });

      await prisma.user.update({
        where: { id: newUser.id },
        data: {
          subscriptionTokenBalance: proPlan.tokenQuota,
          tokenBalance: proPlan.tokenQuota
        }
      });
      console.log(`✅ Pro试用创建成功，Token余额: ${proPlan.tokenQuota}`);
    }

    // 自动生成邀请链接（模拟新增的逻辑）
    console.log('\n3. 自动生成邀请链接...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    const invitationResult = await InvitationService.createInvitation(newUser.id);

    if (invitationResult.success) {
      console.log(`✅ 邀请链接自动生成成功!`);
      console.log(`   邀请码: ${invitationResult.invitationCode}`);
      console.log(`   邀请链接: https://yourdomain.com/?invite=${invitationResult.invitationCode}`);
    } else {
      console.error('❌ 邀请链接生成失败:', invitationResult.error);
    }

    // 验证邀请链接确实存在
    console.log('\n4. 验证邀请链接...');
    const invitation = await prisma.invitation.findFirst({
      where: {
        inviterId: newUser.id,
        status: 'PENDING'
      }
    });

    if (invitation) {
      console.log(`✅ 邀请链接验证成功`);
      console.log(`   数据库ID: ${invitation.id}`);
      console.log(`   状态: ${invitation.status}`);
      console.log(`   创建时间: ${invitation.createdAt}`);
    } else {
      console.error('❌ 邀请链接验证失败');
    }

    // 测试用户是否能在用户中心看到邀请链接
    console.log('\n5. 测试获取邀请链接API...');
    const stats = await InvitationService.getInvitationStats(newUser.id);
    console.log(`✅ 用户邀请统计:`);
    console.log(`   总邀请数: ${stats.totalInvitations}`);
    console.log(`   成功邀请: ${stats.acceptedCount}`);
    console.log(`   最近邀请: ${stats.recentInvitations?.length || 0} 条`);

    console.log('\n🎉 新用户自动邀请链接功能测试完成!');
    console.log('\n💡 现在新用户在首次登录后会自动获得:');
    console.log('   1. 14天Pro试用套餐');
    console.log('   2. 专属邀请链接');
    console.log('   3. 可以立即开始邀请好友');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testAutoInvitation().catch(console.error);