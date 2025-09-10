import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSubscriptionData() {
  console.log('🔍 检查订阅和套餐数据...\n');

  try {
    // 1. 检查所有套餐
    console.log('📋 所有套餐:');
    const plans = await prisma.plan.findMany({
      include: {
        planFeatures: true,
        _count: {
          select: { subscriptions: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    for (const plan of plans) {
      console.log(`\n  ${plan.name.toUpperCase()} 套餐:`);
      console.log(`    - ID: ${plan.id}`);
      console.log(`    - 价格: ¥${plan.price}/${plan.interval}`);
      console.log(`    - Token配额: ${plan.tokenQuota}`);
      console.log(`    - 订阅用户数: ${plan._count.subscriptions}`);
      console.log(`    - 功能特性:`);
      
      for (const feature of plan.planFeatures) {
        const value = feature.metadata?.value ?? feature.limit;
        const name = feature.metadata?.name || feature.featureName;
        console.log(`      * ${name}: ${feature.enabled ? '✓' : '✗'} ${value !== null && value !== undefined ? `(${value})` : ''}`);
      }
    }

    // 2. 检查所有活跃订阅
    console.log('\n\n📊 活跃订阅统计:');
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      },
      include: {
        plan: {
          include: {
            planFeatures: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { currentPeriodEnd: 'desc' }
    });

    console.log(`\n总活跃订阅数: ${activeSubscriptions.length}`);

    // 按套餐分组统计
    const subscriptionByPlan = activeSubscriptions.reduce((acc, sub) => {
      const planName = sub.plan.name;
      if (!acc[planName]) {
        acc[planName] = [];
      }
      acc[planName].push(sub);
      return acc;
    }, {} as Record<string, typeof activeSubscriptions>);

    for (const [planName, subs] of Object.entries(subscriptionByPlan)) {
      console.log(`\n  ${planName.toUpperCase()} 套餐订阅用户 (${subs.length}人):`);
      subs.slice(0, 5).forEach(sub => {
        const daysLeft = Math.ceil((new Date(sub.currentPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        console.log(`    - ${sub.user.email || sub.user.name} (剩余${daysLeft}天)`);
      });
      if (subs.length > 5) {
        console.log(`    ... 还有 ${subs.length - 5} 个用户`);
      }
    }

    // 3. 检查是否有过期但仍标记为ACTIVE的订阅
    console.log('\n\n⚠️  检查异常订阅:');
    const expiredActiveSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lte: new Date() }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        },
        plan: {
          select: {
            name: true
          }
        }
      }
    });

    if (expiredActiveSubscriptions.length > 0) {
      console.log(`发现 ${expiredActiveSubscriptions.length} 个已过期但仍标记为ACTIVE的订阅:`);
      expiredActiveSubscriptions.forEach(sub => {
        console.log(`  - 用户 ${sub.user.email} (${sub.plan.name}) - 过期时间: ${sub.currentPeriodEnd}`);
      });
    } else {
      console.log('✅ 没有发现异常的订阅状态');
    }

    // 4. 检查没有订阅的用户
    console.log('\n\n👥 用户订阅状态:');
    const totalUsers = await prisma.user.count({
      where: { 
        status: 'ACTIVE',
        isActive: true 
      }
    });
    
    const usersWithSubscription = await prisma.user.count({
      where: {
        status: 'ACTIVE',
        isActive: true,
        subscriptions: {
          some: {
            status: 'ACTIVE',
            currentPeriodEnd: { gt: new Date() }
          }
        }
      }
    });

    console.log(`总活跃用户: ${totalUsers}`);
    console.log(`有订阅的用户: ${usersWithSubscription}`);
    console.log(`无订阅的用户: ${totalUsers - usersWithSubscription}`);

    // 5. 检查套餐名称是否标准化
    console.log('\n\n📝 套餐名称检查:');
    const nonStandardPlans = plans.filter(plan => 
      !['free', 'pro', 'max'].includes(plan.name.toLowerCase())
    );
    
    if (nonStandardPlans.length > 0) {
      console.log('发现非标准套餐名称:');
      nonStandardPlans.forEach(plan => {
        console.log(`  - ${plan.name} (ID: ${plan.id})`);
      });
    } else {
      console.log('✅ 所有套餐名称都是标准的');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscriptionData();