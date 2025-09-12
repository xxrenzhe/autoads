import { PrismaClient, Interval } from '@prisma/client';

const prisma = new PrismaClient();

const defaultPlans = [
  {
    name: 'Free',
    description: '适合个人用户和小型项目',
    price: 0,
    currency: 'USD',
    interval: Interval.MONTH,
    features: JSON.stringify([
      '支持"真实点击"功能，包括"初级版本"和"静默版本"',
      '支持"网站排名"功能',
      '批量查询域名上限100个/次',
      '包含1,000 tokens'
    ]),
    limits: JSON.stringify({
      maxBatchSize: 100,
      maxRequestsPerMinute: 60,
      siteRankDomains: 100,
      adsAccounts: 0
    }),
    tokenQuota: 1000,
    tokenReset: 'MONTHLY',
    billingPeriod: 'MONTHLY',
    rateLimit: 60,
    isActive: true,
    sortOrder: 0
  },
  {
    name: 'Pro',
    description: '适合成长型企业和专业用户',
    price: 298,
    currency: 'USD',
    interval: Interval.MONTH,
    features: JSON.stringify([
      '支持所有免费套餐的功能',
      '支持"真实点击"功能，包括"自动化版本"',
      '支持"网站排名"功能，批量查询域名上限500个/次',
      '支持"自动化广告"功能，批量管理ads账号（上限10个）',
      '包含10,000 tokens'
    ]),
    limits: JSON.stringify({
      maxBatchSize: 500,
      maxRequestsPerMinute: 120,
      siteRankDomains: 500,
      adsAccounts: 10
    }),
    tokenQuota: 10000,
    tokenReset: 'MONTHLY',
    billingPeriod: 'MONTHLY',
    rateLimit: 120,
    isActive: true,
    sortOrder: 1,
    extraTokenOptions: JSON.stringify({
      yearlyDiscount: 0.5,
      yearlyBonusTokens: 2000
    })
  },
  {
    name: 'Max',
    description: '适合大型企业和高用量用户',
    price: 998,
    currency: 'USD',
    interval: Interval.MONTH,
    features: JSON.stringify([
      '支持所有高级套餐的功能',
      '"网站排名"功能，批量查询域名上限5000个/次',
      '"自动化广告"功能，批量管理ads账号（上限100个）',
      '包含100,000 tokens',
      '优先技术支持',
      '专属客户经理'
    ]),
    limits: JSON.stringify({
      maxBatchSize: 5000,
      maxRequestsPerMinute: 300,
      siteRankDomains: 5000,
      adsAccounts: 100
    }),
    tokenQuota: 100000,
    tokenReset: 'MONTHLY',
    billingPeriod: 'MONTHLY',
    rateLimit: 300,
    isActive: true,
    sortOrder: 2,
    extraTokenOptions: JSON.stringify({
      yearlyDiscount: 0.5,
      yearlyBonusTokens: 20000
    })
  }
];

async function main() {
  console.log('开始创建默认订阅套餐...');

  for (const planData of defaultPlans) {
    // 检查是否已存在
    const existingPlan = await prisma.plan.findFirst({
      where: { name: planData.name }
    });

    if (!existingPlan) {
      // 计算年付价格
      const yearlyPrice = planData.price > 0 ? planData.price * 12 * (1 - (planData.extraTokenOptions ? JSON.parse(planData.extraTokenOptions).yearlyDiscount || 0 : 0)) : 0;
      
      await prisma.plan.create({
        data: {
          ...planData,
          stripeYearlyPriceId: `price_${planData.name.toLowerCase()}_yearly`,
          metadata: JSON.stringify({
            yearlyPrice,
            features: planData.features,
            limits: planData.limits,
            ...(planData.extraTokenOptions && { extraTokenOptions: planData.extraTokenOptions })
          })
        }
      });
      
      console.log(`✅ 创建套餐: ${planData.name}`);
    } else {
      console.log(`⚠️  套餐已存在: ${planData.name}`);
    }
  }

  console.log('默认套餐创建完成！');
}

main()
  .catch((e) => {
    console.error('创建套餐时出错:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });