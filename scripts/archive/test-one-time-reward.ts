import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testOneTimeReward() {
  try {
    console.log('🧪 测试每个用户只能获得一次邀请奖励...\n');

    // 1. 创建三个邀请人
    console.log('1. 创建三个邀请人...');
    const inviterA = await prisma.user.upsert({
      where: { email: 'inviterA@test.com' },
      update: {},
      create: {
        email: 'inviterA@test.com',
        name: '邀请人A',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });

    const inviterB = await prisma.user.upsert({
      where: { email: 'inviterB@test.com' },
      update: {},
      create: {
        email: 'inviterB@test.com',
        name: '邀请人B',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });

    const inviterC = await prisma.user.upsert({
      where: { email: 'inviterC@test.com' },
      update: {},
      create: {
        email: 'inviterC@test.com',
        name: '邀请人C',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });

    console.log(`✅ 邀请人创建成功: ${inviterA.email}, ${inviterB.email}, ${inviterC.email}`);

    // 2. 创建三个邀请码
    console.log('\n2. 创建邀请码...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    
    const codeA = await InvitationService.createInvitation(inviterA.id);
    const codeB = await InvitationService.createInvitation(inviterB.id);
    const codeC = await InvitationService.createInvitation(inviterC.id);
    
    console.log(`✅ 邀请码: A=${codeA.invitationCode}, B=${codeB.invitationCode}, C=${codeC.invitationCode}`);

    // 3. 创建一个被邀请人
    console.log('\n3. 创建被邀请人...');
    const invited = await prisma.user.upsert({
      where: { email: 'invited-one-time@test.com' },
      update: {},
      create: {
        email: 'invited-one-time@test.com',
        name: '被邀请人',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`✅ 被邀请人: ${invited.email}`);

    // 4. 使用第一个邀请码
    console.log('\n4. 使用邀请人A的邀请码...');
    const result1 = await InvitationService.acceptInvitation(
      codeA.invitationCode!,
      invited.id
    );

    if (result1.success) {
      console.log('✅ 第一次使用成功');
      console.log(`   消息: ${result1.message}`);
    } else {
      console.error('❌ 第一次使用失败:', result1.error);
      return;
    }

    // 5. 尝试使用第二个邀请码（应该失败）
    console.log('\n5. 尝试使用邀请人B的邀请码...');
    const result2 = await InvitationService.acceptInvitation(
      codeB.invitationCode!,
      invited.id
    );

    if (result2.success) {
      console.log('❌ 第二次使用不应该成功！');
    } else {
      console.log('✅ 第二次使用被正确拒绝');
      console.log(`   错误: ${result2.error}`);
    }

    // 6. 尝试使用第三个邀请码（应该失败）
    console.log('\n6. 尝试使用邀请人C的邀请码...');
    const result3 = await InvitationService.acceptInvitation(
      codeC.invitationCode!,
      invited.id
    );

    if (result3.success) {
      console.log('❌ 第三次使用不应该成功！');
    } else {
      console.log('✅ 第三次使用被正确拒绝');
      console.log(`   错误: ${result3.error}`);
    }

    // 7. 检查被邀请人的订阅
    console.log('\n7. 检查被邀请人的订阅...');
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: invited.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`   订阅数量: ${subscriptions.length}`);
    subscriptions.forEach(sub => {
      console.log(`   - ${sub.plan.name}: ${sub.status} (至: ${sub.currentPeriodEnd.toLocaleDateString()})`);
    });

    console.log('\n🎉 测试完成!');
    console.log('\n💡 预期结果：');
    console.log('   - 每个用户只能通过邀请系统获得一次奖励');
    console.log('   - 即使用不同的邀请码，第二次及以后的使用都会被拒绝');
    console.log('   - 被邀请人只获得一次30天Pro套餐');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testOneTimeReward().catch(console.error);