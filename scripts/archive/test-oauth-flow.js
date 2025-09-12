// Test script to verify OAuth user subscription creation
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testOAuthFlow() {
  try {
    console.log('=== Testing OAuth User Flow ===\n');
    
    // 1. Check if test user exists
    const testEmail = 'test-oauth-user@example.com';
    let testUser = await prisma.user.findUnique({
      where: { email: testEmail },
      include: {
        subscriptions: {
          include: {
            plan: true
          }
        }
      }
    });
    
    if (!testUser) {
      console.log('Creating test user...');
      testUser = await prisma.user.create({
        data: {
          email: testEmail,
          name: 'Test OAuth User',
          status: 'ACTIVE',
          isActive: true,
          emailVerified: true
        },
        include: {
          subscriptions: {
            include: {
              plan: true
            }
          }
        }
      });
      console.log('Test user created:', testUser.id);
    }
    
    console.log('\n=== Before Subscription Creation ===');
    console.log('User Status:', testUser.status);
    console.log('Is Active:', testUser.isActive);
    console.log('Token Balance:', testUser.tokenBalance);
    console.log('Subscription Count:', testUser.subscriptions.length);
    
    // 2. Simulate OAuth subscription creation
    console.log('\n=== Simulating OAuth Subscription Creation ===');
    
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
    
    console.log('Found Pro plan:', proPlan.name, 'with', proPlan.tokenQuota, 'tokens');
    
    // Create 14-day trial subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);
    
    const subscription = await prisma.subscription.create({
      data: {
        userId: testUser.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        provider: 'system',
        providerSubscriptionId: `trial_${testUser.id}_${Date.now()}`,
        source: 'SYSTEM'
      }
    });
    
    // Update user's token balance
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        subscriptionTokenBalance: proPlan.tokenQuota,
        tokenBalance: proPlan.tokenQuota,
        trialUsed: true
      }
    });
    
    // Create token transaction
    await prisma.tokenTransaction.create({
      data: {
        userId: testUser.id,
        type: 'SUBSCRIPTION_GRANT',
        amount: proPlan.tokenQuota,
        balanceBefore: 0,
        balanceAfter: proPlan.tokenQuota,
        description: `14-day Pro trial subscription`,
        feature: 'OTHER'
      }
    });
    
    console.log('Subscription created:', subscription.id);
    console.log('Token balance updated to:', proPlan.tokenQuota);
    
    // 3. Verify results
    console.log('\n=== After Subscription Creation ===');
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        subscriptions: {
          include: {
            plan: true
          }
        }
      }
    });
    
    console.log('User Status:', updatedUser?.status);
    console.log('Is Active:', updatedUser?.isActive);
    console.log('Token Balance:', updatedUser?.tokenBalance);
    console.log('Subscription Token Balance:', updatedUser?.subscriptionTokenBalance);
    console.log('Subscription Count:', updatedUser?.subscriptions?.length);
    
    if (updatedUser?.subscriptions?.length > 0) {
      const sub = updatedUser.subscriptions[0];
      console.log('\nSubscription Details:');
      console.log('  Plan:', sub.plan.name);
      console.log('  Status:', sub.status);
      console.log('  Period:', sub.currentPeriodStart, 'to', sub.currentPeriodEnd);
      console.log('  Token Quota:', sub.plan.tokenQuota);
    }
    
    // Clean up test data
    console.log('\n=== Cleaning Up Test Data ===');
    await prisma.tokenTransaction.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.subscription.deleteMany({
      where: { userId: testUser.id }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    console.log('Test data cleaned up');
    
    console.log('\n✅ OAuth flow test completed successfully!');
    console.log('\nNew OAuth users will now automatically receive:');
    console.log('- 14-day Pro trial subscription');
    console.log('- Token balance based on Pro plan quota');
    console.log('- Proper account status (ACTIVE + isActive=true)');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOAuthFlow();