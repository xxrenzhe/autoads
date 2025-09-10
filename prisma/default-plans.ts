import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建默认套餐...');

  // 创建免费套餐
  const freePlan = await prisma.plan.upsert({
    where: { id: 'free' },
    update: {},
    create: {
      id: 'free',
      name: '免费套餐',
      description: '适合个人用户免费试用',
      price: 0,
      currency: 'CNY',
      interval: 'MONTH',
      billingPeriod: 'MONTHLY',
      tokenQuota: 1000,
      rateLimit: 30,
      tokenReset: 'monthly',
      isActive: true,
      sortOrder: 1,
      features: [
        'batchopen_basic',      // 真实点击-初级版本
        'batchopen_silent',     // 真实点击-静默版本
        'siterank_basic'        // 网站排名-基础版本
      ],
      metadata: {
        category: 'free',
        yearlyDiscount: 0,
        highlightFeatures: [
          '支持"真实点击"功能（初级版本和静默版本）',
          '支持"网站排名"功能',
          '批量查询域名上限100个/次'
        ]
      },
      limits: {
        siterank: {
          batchLimit: 100
        },
        batchopen: {
          versions: ['basic', 'silent']
        },
        changelink: {
          maxCampaigns: 0
        },
        api: {
          rateLimit: 30
        }
      },
      extraTokenOptions: [
        { tokens: 1000, price: 9.9, currency: 'CNY' },
        { tokens: 5000, price: 39.9, currency: 'CNY' }
      ]
    }
  });

  // 创建高级套餐
  const proPlan = await prisma.plan.upsert({
    where: { id: 'pro' },
    update: {},
    create: {
      id: 'pro',
      name: '高级套餐',
      description: '适合专业用户和小型团队',
      price: 298,
      currency: 'CNY',
      interval: 'MONTH',
      billingPeriod: 'MONTHLY',
      tokenQuota: 10000,
      rateLimit: 100,
      tokenReset: 'monthly',
      isActive: true,
      sortOrder: 2,
      stripePriceId: 'price_pro_monthly',
      stripeYearlyPriceId: 'price_pro_yearly',
      features: [
        'batchopen_basic',
        'batchopen_silent',
        'batchopen_automated',  // 自动化版本
        'siterank_pro',
        'changelink_basic'
      ],
      metadata: {
        category: 'pro',
        yearlyDiscount: 0.5, // 年付优惠50%
        highlightFeatures: [
          '所有免费套餐功能',
          '"真实点击"功能支持"白金版本"',
          '"网站排名"批量查询域名上限500个/次',
          '支持"自动化广告"功能，批量管理ads账号（上限10个）'
        ]
      },
      limits: {
        siterank: {
          batchLimit: 500
        },
        batchopen: {
          versions: ['basic', 'silent', 'automated']
        },
        changelink: {
          maxCampaigns: 10,
          maxAccounts: 10
        },
        api: {
          rateLimit: 100
        }
      },
      extraTokenOptions: [
        { tokens: 1000, price: 8, currency: 'CNY' },
        { tokens: 5000, price: 35, currency: 'CNY' },
        { tokens: 10000, price: 65, currency: 'CNY' }
      ]
    }
  });

  // 创建白金套餐
  const maxPlan = await prisma.plan.upsert({
    where: { id: 'max' },
    update: {},
    create: {
      id: 'max',
      name: '白金套餐',
      description: '适合大型企业和高级用户',
      price: 998,
      currency: 'CNY',
      interval: 'MONTH',
      billingPeriod: 'MONTHLY',
      tokenQuota: 100000,
      rateLimit: 500,
      tokenReset: 'monthly',
      isActive: true,
      sortOrder: 3,
      stripePriceId: 'price_max_monthly',
      stripeYearlyPriceId: 'price_max_yearly',
      features: [
        'batchopen_basic',
        'batchopen_silent',
        'batchopen_automated',
        'siterank_max',
        'changelink_pro',
        'api_advanced',
        'priority_support'
      ],
      metadata: {
        category: 'max',
        yearlyDiscount: 0.5, // 年付优惠50%
        highlightFeatures: [
          '所有高级套餐功能',
          '"网站排名"批量查询域名上限9999个/次',
          '"自动化广告"批量管理ads账号（上限100个）',
          '支持其他高级功能'
        ]
      },
      limits: {
        siterank: {
          batchLimit: 9999
        },
        batchopen: {
          versions: ['basic', 'silent', 'automated']
        },
        changelink: {
          maxCampaigns: 100,
          maxAccounts: 100
        },
        api: {
          rateLimit: 500
        }
      },
      extraTokenOptions: [
        { tokens: 1000, price: 7, currency: 'CNY' },
        { tokens: 5000, price: 30, currency: 'CNY' },
        { tokens: 10000, price: 55, currency: 'CNY' },
        { tokens: 50000, price: 250, currency: 'CNY' }
      ]
    }
  });

  console.log('默认套餐创建成功:');
  console.log(`- ${freePlan.name} (¥${freePlan.price}/月)`);
  console.log(`- ${proPlan.name} (¥${proPlan.price}/月, 年付优惠50%)`);
  console.log(`- ${maxPlan.name} (¥${maxPlan.price}/月, 年付优惠50%)`);
}

main()
  .catch((e) => {
    console.error('创建套餐失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });