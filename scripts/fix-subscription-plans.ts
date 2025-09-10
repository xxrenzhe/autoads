import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSubscriptionPlans() {
  console.log('🔧 修复订阅计划数据...\n');

  try {
    // 获取所有套餐
    const plans = await prisma.plan.findMany({
      include: {
        planFeatures: true,
        subscriptions: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // 找出重复的套餐
    const planGroups = plans.reduce((acc, plan) => {
      const name = plan.name.toLowerCase();
      if (!acc[name]) {
        acc[name] = [];
      }
      acc[name].push(plan);
      return acc;
    }, {} as Record<string, typeof plans>);

    console.log('📋 发现的套餐分组:');
    for (const [name, group] of Object.entries(planGroups)) {
      console.log(`\n  ${name.toUpperCase()} 套餐 (${group.length}个):`);
      group.forEach((plan, index) => {
        const hasFeatures = plan.planFeatures.length > 0;
        const hasSubscriptions = plan.subscriptions.length > 0;
        console.log(`    ${index + 1}. ID: ${plan.id} - 价格: ¥${plan.price} - 功能: ${hasFeatures ? '✓' : '✗'} - 订阅: ${hasSubscriptions ? '✓' : '✗'}`);
      });
    }

    // 找出正确的套餐（有功能特性的）和需要迁移的套餐
    const migrations = [];
    for (const [name, group] of Object.entries(planGroups)) {
      if (group.length > 1) {
        // 找出有功能特性的套餐作为目标
        const targetPlan = group.find(p => p.planFeatures.length > 0);
        const sourcePlans = group.filter(p => p.id !== targetPlan?.id && p.subscriptions.length > 0);
        
        if (targetPlan && sourcePlans.length > 0) {
          migrations.push({
            targetPlan,
            sourcePlans
          });
        }
      }
    }

    if (migrations.length === 0) {
      console.log('\n✅ 没有需要迁移的订阅');
      return;
    }

    console.log('\n🔄 准备迁移订阅:');
    for (const migration of migrations) {
      console.log(`\n  将订阅迁移到 ${migration.targetPlan.name.toUpperCase()} 套餐 (ID: ${migration.targetPlan.id}):`);
      for (const sourcePlan of migration.sourcePlans) {
        console.log(`    从: ${sourcePlan.name} (ID: ${sourcePlan.id}) - ${sourcePlan.subscriptions.length} 个订阅`);
      }
    }

    // 执行迁移
    console.log('\n⚙️  开始迁移...');
    for (const migration of migrations) {
      const { targetPlan, sourcePlans } = migration;
      
      for (const sourcePlan of sourcePlans) {
        console.log(`\n  迁移 ${sourcePlan.subscriptions.length} 个订阅从 ${sourcePlan.id} 到 ${targetPlan.id}...`);
        
        // 更新所有订阅
        for (const subscription of sourcePlan.subscriptions) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { planId: targetPlan.id }
          });
          console.log(`    ✓ 已迁移订阅 ${subscription.id} (用户: ${subscription.userId})`);
        }
        
        // 删除旧的套餐
        await prisma.plan.delete({
          where: { id: sourcePlan.id }
        });
        console.log(`    ✓ 已删除旧套餐 ${sourcePlan.id}`);
      }
    }

    console.log('\n✅ 迁移完成！');

    // 验证结果
    console.log('\n🔍 验证迁移结果:');
    const remainingPlans = await prisma.plan.findMany({
      include: {
        _count: {
          select: { subscriptions: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log('\n剩余套餐:');
    for (const plan of remainingPlans) {
      console.log(`  ${plan.name} (ID: ${plan.id}) - ${plan._count.subscriptions} 个订阅`);
    }

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixSubscriptionPlans()
  .then(() => {
    console.log('\n🎉 订阅计划修复完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 迁移过程中出现错误:', error);
    process.exit(1);
  });