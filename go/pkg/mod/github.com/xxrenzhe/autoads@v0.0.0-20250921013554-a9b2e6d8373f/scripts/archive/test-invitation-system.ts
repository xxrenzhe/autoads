import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInvitationSystem() {
  try {
    console.log('🧪 测试邀请系统...\n');

    // 1. 创建测试用户（邀请人）
    console.log('1. 创建测试用户（邀请人）...');
    const inviter = await prisma.user.upsert({
      where: { email: 'inviter@test.com' },
      update: {},
      create: {
        email: 'inviter@test.com',
        name: '测试邀请人',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 邀请人创建成功: ${inviter.email} (ID: ${inviter.id})`);

    // 2. 创建邀请码
    console.log('\n2. 创建邀请码...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    const invitationResult = await InvitationService.createInvitation(inviter.id);
    
    if (invitationResult.success) {
      console.log(`✅ 邀请码创建成功: ${invitationResult.invitationCode}`);
    } else {
      console.error('❌ 邀请码创建失败:', invitationResult.error);
      return;
    }

    // 3. 验证邀请码
    console.log('\n3. 验证邀请码...');
    const validation = await InvitationService.validateInvitationCode(invitationResult.invitationCode!);
    if (validation.valid) {
      console.log(`✅ 邀请码验证成功，邀请人: ${validation.inviter?.email}`);
    } else {
      console.error('❌ 邀请码验证失败:', validation.error);
    }

    // 4. 创建被邀请用户
    console.log('\n4. 创建被邀请用户...');
    const invited = await prisma.user.upsert({
      where: { email: 'invited@test.com' },
      update: {},
      create: {
        email: 'invited@test.com',
        name: '测试被邀请人',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 被邀请人创建成功: ${invited.email} (ID: ${invited.id})`);

    // 5. 接受邀请
    console.log('\n5. 接受邀请...');
    const acceptResult = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited.id
    );

    if (acceptResult.success) {
      console.log('✅ 邀请接受成功!');
      console.log(`   消息: ${acceptResult.message}`);
    } else {
      console.error('❌ 邀请接受失败:', acceptResult.error);
    }

    // 6. 检查订阅状态
    console.log('\n6. 检查订阅状态...');
    const [inviterSubscription, invitedSubscription] = await Promise.all([
      prisma.subscription.findFirst({
        where: { 
          userId: inviter.id,
          status: 'ACTIVE'
        },
        include: { plan: true }
      }),
      prisma.subscription.findFirst({
        where: { 
          userId: invited.id,
          status: 'ACTIVE'
        },
        include: { plan: true }
      })
    ]);

    if (inviterSubscription) {
      console.log(`✅ 邀请人获得订阅: ${inviterSubscription.plan.name} (30天)`);
    } else {
      console.log('❌ 邀请人未获得订阅');
    }

    if (invitedSubscription) {
      console.log(`✅ 被邀请人获得订阅: ${invitedSubscription.plan.name} (30天)`);
    } else {
      console.log('❌ 被邀请人未获得订阅');
    }

    // 7. 检查邀请状态
    console.log('\n7. 检查邀请状态...');
    const updatedInvitation = await prisma.invitation.findUnique({
      where: { code: invitationResult.invitationCode },
      include: { invited: true }
    });

    if (updatedInvitation) {
      console.log(`✅ 邀请状态: ${updatedInvitation.status}`);
      console.log(`   被邀请人: ${updatedInvitation.invited?.email || '无'}`);
    }

    // 8. 测试重复接受
    console.log('\n8. 测试重复接受...');
    const duplicateResult = await InvitationService.acceptInvitation(
      invitationResult.invitationCode!,
      invited.id
    );
    
    if (!duplicateResult.success) {
      console.log('✅ 重复接受被正确拒绝:', duplicateResult.error);
    } else {
      console.error('❌ 重复接受应该被拒绝');
    }

    console.log('\n🎉 邀请系统测试完成!');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testInvitationSystem().catch(console.error);