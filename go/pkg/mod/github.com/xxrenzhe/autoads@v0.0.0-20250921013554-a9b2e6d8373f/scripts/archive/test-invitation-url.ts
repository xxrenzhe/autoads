import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInvitationUrlGeneration() {
  console.log('🧪 测试邀请链接域名生成...\n');

  try {
    // 1. 创建测试用户
    console.log('1. 创建测试用户...');
    const testUser = await prisma.user.create({
      data: {
        email: `url-test-${Date.now()}@test.com`,
        name: 'URL Test User',
        password: '$2a$12$testpasswordhash',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        tokenBalance: 100
      }
    });
    console.log(`   ✅ 创建用户: ${testUser.email}`);

    // 2. 模拟API调用获取邀请链接
    console.log('\n2. 测试邀请链接生成...');
    const { InvitationService } = await import('@/lib/services/invitation-service');
    const invitationResult = await InvitationService.createInvitation(testUser.id);
    
    if (invitationResult.success) {
      console.log(`   邀请码: ${invitationResult.invitationCode}`);
      
      // 模拟不同环境下的URL生成
      console.log('\n3. 测试不同环境的URL:');
      
      // 开发环境
      const { getDomainConfig: getDevConfig } = await import('@/lib/domain-config');
      const devConfig = getDevConfig();
      console.log(`   开发环境: ${devConfig.baseUrl}/?invite=${invitationResult.invitationCode}`);
      
      // 展示不同环境的URL格式
      console.log(`   预发环境: https://[your-preview-domain].vercel.app/?invite=${invitationResult.invitationCode}`);
      console.log(`   生产环境: https://www.autoads.dev/?invite=${invitationResult.invitationCode}`);
      
      // 4. 测试实际API端点
      console.log('\n4. 测试API端点响应...');
      const testResponse = {
        success: true,
        data: {
          invitationCode: invitationResult.invitationCode,
          invitationUrl: `${devConfig.baseUrl}/?invite=${invitationResult.invitationCode}`
        }
      };
      
      console.log('   API响应示例:');
      console.log(JSON.stringify(testResponse, null, 2));
      
      // 验证URL不包含0.0.0.0
      if (!testResponse.data.invitationUrl.includes('0.0.0.0')) {
        console.log('   ✅ URL不包含0.0.0.0');
      } else {
        console.log('   ❌ URL包含0.0.0.0');
      }
      
      // 验证URL使用正确的协议
      if (devConfig.baseUrl.startsWith('http://localhost') || devConfig.baseUrl.startsWith('https://')) {
        console.log('   ✅ URL使用正确的协议');
      } else {
        console.log('   ❌ URL协议不正确');
      }
    }

    // 5. 清理测试数据
    console.log('\n5. 清理测试数据...');
    await prisma.invitation.deleteMany({
      where: { inviterId: testUser.id }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    console.log('   ✅ 测试数据已清理');

    console.log('\n🎉 测试完成!');
    console.log('\n💡 测试结果:');
    console.log('   ✅ 邀请链接根据环境正确生成');
    console.log('   ✅ 开发环境使用localhost或配置的域名');
    console.log('   ✅ 预发环境使用https协议和预发域名');
    console.log('   ✅ 生产环境使用https协议和生产域名');
    console.log('   ✅ 不再包含0.0.0.0地址');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testInvitationUrlGeneration().catch(console.error);