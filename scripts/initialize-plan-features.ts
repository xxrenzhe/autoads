import { PrismaClient } from '@prisma/client';
import { PlanFeaturesService } from '../src/lib/services/plan-features-service';

const prisma = new PrismaClient();

async function initializePlans() {
  console.log('🚀 Initializing standardized plan features...\n');

  try {
    // Check if plans already exist
    const existingPlans = await prisma.plan.findMany({
      where: {
        name: {
          in: ['free', 'pro', 'max']
        }
      }
    });

    if (existingPlans.length > 0) {
      console.log('ℹ️  Default plans already exist, updating features...');
    } else {
      console.log('📝 Creating default plans...');
    }

    // Initialize plans with standardized features
    await PlanFeaturesService.initializeDefaultPlans();

    console.log('\n✅ Plan features initialized successfully!');

    // Display summary
    console.log('\n📊 Plan Summary:');
    const plans = await prisma.plan.findMany({
      where: {
        name: {
          in: ['free', 'pro', 'max']
        }
      },
      orderBy: {
        sortOrder: 'asc'
      },
      include: {
        planFeatures: {
          select: {
            featureName: true,
            enabled: true,
            limit: true,
            metadata: true
          }
        }
      }
    });

    for (const plan of plans) {
      console.log(`\n  ${plan.name.toUpperCase()} Plan (¥${plan.price}/${plan.interval})`);
      console.log(`    Token Quota: ${plan.tokenQuota}/month`);
      console.log(`    Rate Limit: ${plan.rateLimit}/request`);
      if (plan.yearlyDiscount > 0) {
        console.log(`    Yearly Discount: ${plan.yearlyDiscount}% off`);
      }
      
      // Show key features
      const keyFeatures = plan.planFeatures.filter(f => 
        ['REAL_CLICK_AUTOMATED', 'WEBSITE_RANKING_BATCH_LIMIT', 'ADS_ACCOUNT_LIMIT'].includes(f.featureName)
      );
      
      if (keyFeatures.length > 0) {
        console.log('    Key Features:');
        for (const feature of keyFeatures) {
          if (feature.enabled) {
            const value = feature.metadata?.value ?? feature.limit;
            const unit = feature.metadata?.unit || '';
            const name = feature.metadata?.name || feature.featureName;
            
            if (value !== null && value !== undefined) {
              console.log(`      ✓ ${name}: ${value} ${unit}`);
            } else {
              console.log(`      ✓ ${name}`);
            }
          }
        }
      }
    }

    console.log('\n🎉 Initialization complete!');

  } catch (error) {
    console.error('❌ Error initializing plan features:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run initialization
initializePlans()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });