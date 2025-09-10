import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function postDeployInit() {
  console.log('🚀 执行部署后初始化...');

  try {
    // 1. 检查并初始化套餐特性
    const planCount = await prisma.plan.count({
      where: {
        name: {
          in: ['free', 'pro', 'max']
        }
      }
    });

    if (planCount === 0) {
      console.log('📝 初始化默认套餐...');
      // 创建默认套餐
      await prisma.plan.createMany({
        data: [
          {
            name: 'free',
            description: '基础功能，适合个人用户',
            price: 0,
            tokenQuota: 1000,
            rateLimit: 100,
            features: {
              basicUrlCheck: true,
              basicReports: true,
              apiAccess: false
            }
          },
          {
            name: 'pro',
            description: '高级功能，适合专业用户',
            price: 29.99,
            tokenQuota: 10000,
            rateLimit: 1000,
            features: {
              basicUrlCheck: true,
              basicReports: true,
              apiAccess: true,
              advancedReports: true,
              bulkChecking: true
            }
          },
          {
            name: 'max',
            description: '所有功能，适合企业用户',
            price: 99.99,
            tokenQuota: 50000,
            rateLimit: 5000,
            features: {
              basicUrlCheck: true,
              basicReports: true,
              apiAccess: true,
              advancedReports: true,
              bulkChecking: true,
              prioritySupport: true,
              customIntegrations: true
            }
          }
        ]
      });
      console.log('✅ 默认套餐创建完成');
    } else {
      console.log('✅ 套餐已存在，跳过初始化');
    }

    // 2. 检查数据库迁移状态
    try {
      const migrations = await prisma.$queryRaw`
        SELECT count(*)::int as count 
        FROM _prisma_migrations 
        WHERE finished_at IS NULL
      `;

      if (migrations[0].count > 0) {
        console.log('⚠️  存在未完成的迁移');
      }
    } catch (error) {
      // _prisma_migrations 表可能不存在
      console.log('ℹ️  无法检查迁移状态，可能使用了 db push');
    }

    // 3. 检查新添加的枚举值
    try {
      // 检查 SubscriptionSource 枚举
      const subscriptionCheck = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'subscriptions' 
          AND column_name = 'source'
        ) as exists
      `;

      if (!subscriptionCheck[0].exists) {
        console.log('⚠️  subscriptions 表缺少 source 字段，需要运行迁移');
      }

      // 检查用户表的试用标记
      const userCheck = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'trialused'
        ) as exists
      `;

      if (!userCheck[0].exists) {
        console.log('⚠️  users 表缺少 trialUsed 字段，需要运行迁移');
      }
    } catch (error) {
      console.log('ℹ️  无法检查所有字段，这是正常的');
    }

    console.log('✅ 部署后初始化完成');
  } catch (error) {
    console.error('❌ 部署后初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

postDeployInit();