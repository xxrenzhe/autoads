import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createProTrialForUser() {
  try {
    console.log('🎁 Creating Pro trial subscription for user...\n');
    
    const userEmail = 'yj2008ay611@gmail.com';
    
    // Get the user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptions: {
          where: {
            OR: [
              { status: 'ACTIVE' },
              { 
                status: 'EXPIRED',
                currentPeriodEnd: { 
                  gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) 
                }
              }
            ]
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!user) {
      console.log(`❌ User not found: ${userEmail}`);
      return;
    }
    
    console.log(`👤 Found user: ${user.name} (${user.email})`);
    
    // Check if user already has an active Pro trial
    const hasActiveTrial = user.subscriptions.some(sub => 
      sub.status === 'ACTIVE' && sub.provider === 'system'
    );
    
    if (hasActiveTrial) {
      console.log('✅ User already has an active Pro trial');
      return;
    }
    
    // Get the Pro plan
    const proPlan = await prisma.plan.findFirst({
      where: { name: 'pro', isActive: true }
    });
    
    if (!proPlan) {
      console.log('❌ Pro plan not found');
      return;
    }
    
    console.log(`📋 Found Pro plan: ${proPlan.name} with ${proPlan.tokenQuota} tokens`);
    
    // Create the trial subscription
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);
    
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: trialStartDate,
        currentPeriodEnd: trialEndDate,
        provider: 'system',
        providerSubscriptionId: `trial_${user.id}_${Date.now()}`
      }
    });
    
    // Update user's token balance
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTokenBalance: proPlan.tokenQuota,
        // Don't increment tokenBalance as they already have tokens from the fix
      },
      select: {
        id: true,
        email: true,
        tokenBalance: true,
        subscriptionTokenBalance: true,
        activityTokenBalance: true,
        purchasedTokenBalance: true,
      }
    });
    
    // Create token transaction record
    await prisma.tokenTransaction.create({
      data: {
        userId: user.id,
        type: 'CREDIT',
        amount: proPlan.tokenQuota,
        balanceBefore: updatedUser.tokenBalance + updatedUser.activityTokenBalance + updatedUser.purchasedTokenBalance,
        balanceAfter: updatedUser.tokenBalance + updatedUser.subscriptionTokenBalance + updatedUser.activityTokenBalance + updatedUser.purchasedTokenBalance,
        source: 'trial_subscription',
        description: 'Pro试用套餐 - 14天1000个Token',
        metadata: {
          planName: proPlan.name,
          trialDays: 14,
          subscriptionId: subscription.id
        }
      }
    });
    
    const totalTokens = updatedUser.tokenBalance + 
                       updatedUser.subscriptionTokenBalance + 
                       updatedUser.activityTokenBalance + 
                       updatedUser.purchasedTokenBalance;
    
    console.log('\n✅ Pro trial subscription created successfully!');
    console.log(`   Trial Period: 14 days (${trialStartDate.toLocaleDateString()} - ${trialEndDate.toLocaleDateString()})`);
    console.log(`   Trial Tokens: ${proPlan.tokenQuota}`);
    console.log(`   Total Token Balance: ${totalTokens}`);
    console.log(`   Subscription ID: ${subscription.id}`);
    
  } catch (error) {
    console.error('❌ Error creating Pro trial:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createProTrialForUser().catch(console.error);