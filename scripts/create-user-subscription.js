import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUserSubscription() {
  try {
    const userEmail = 'yj2008ay611@gmail.com';
    
    console.log('Creating subscription for user:', userEmail);
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    // Check if user already has subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE'
      }
    });
    
    if (existingSubscription) {
      console.log('User already has active subscription:', existingSubscription);
      return;
    }
    
    // Get Pro plan
    const proPlan = await prisma.plan.findFirst({
      where: { 
        name: { contains: 'PRO', mode: 'insensitive' },
        isActive: true 
      }
    });
    
    if (!proPlan) {
      console.log('Pro plan not found');
      return;
    }
    
    // Create 14-day trial subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);
    
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        provider: 'system',
        providerSubscriptionId: `trial_${user.id}_${Date.now()}`,
        source: 'SYSTEM'
      }
    });
    
    // Update user's token balance
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTokenBalance: proPlan.tokenQuota,
        tokenBalance: proPlan.tokenQuota,
        trialUsed: true
      }
    });
    
    // Create token transaction
    await prisma.tokenTransaction.create({
      data: {
        userId: user.id,
        type: 'SUBSCRIPTION_GRANT',
        amount: proPlan.tokenQuota,
        balanceBefore: 0,
        balanceAfter: proPlan.tokenQuota,
        description: `14-day Pro trial subscription`,
        feature: 'OTHER'
      }
    });
    
    console.log('\n=== SUBSCRIPTION CREATED ===');
    console.log('Plan:', proPlan.name);
    console.log('Token Quota:', proPlan.tokenQuota);
    console.log('Period:', startDate, 'to', endDate);
    console.log('Subscription ID:', subscription.id);
    
    console.log('\n✅ 14-day Pro trial subscription created successfully!');
    
  } catch (error) {
    console.error('Error creating subscription:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserSubscription();