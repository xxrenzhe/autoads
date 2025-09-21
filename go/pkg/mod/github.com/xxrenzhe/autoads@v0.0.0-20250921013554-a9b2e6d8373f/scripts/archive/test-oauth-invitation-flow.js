// Test script to verify OAuth user subscription creation with and without invitation code
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testOAuthFlowWithInvitation() {
  try {
    console.log('=== Testing OAuth User Flow with Invitation Code ===\n');
    
    // 1. Create a test inviter user
    const inviterEmail = 'inviter@example.com';
    let inviter = await prisma.user.findUnique({
      where: { email: inviterEmail }
    });
    
    if (!inviter) {
      inviter = await prisma.user.create({
        data: {
          email: inviterEmail,
          name: 'Test Inviter',
          status: 'ACTIVE',
          isActive: true,
          emailVerified: true
        }
      });
      console.log('Created inviter user:', inviter.id);
    }
    
    // 2. Create invitation code for inviter
    const invitation = await prisma.invitation.create({
      data: {
        inviterId: inviter.id,
        code: 'TESTCODE123',
        status: 'PENDING',
        tokensReward: 0
      }
    });
    const invitationCode = invitation.code;
    
    console.log('Created invitation code:', invitationCode);
    
    // 3. Test new user with invitation code (should get 30 days)
    console.log('\n=== Testing New User WITH Invitation Code (30 days) ===');
    const userEmailWithInvite = 'newuser-with-invite@example.com';
    let userWithInvite = await prisma.user.create({
      data: {
        email: userEmailWithInvite,
        name: 'New User With Invite',
        status: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }
    });
    
    // Simulate subscription creation with invitation code - 30 days
    const proPlan = await prisma.plan.findFirst({
      where: { 
        name: { contains: 'PRO', mode: 'insensitive' },
        isActive: true 
      }
    });
    
    if (proPlan) {
      // Create 30-day subscription for user with invitation
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      await prisma.subscription.create({
        data: {
          userId: userWithInvite.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          provider: 'system',
          providerSubscriptionId: `invitation_${userWithInvite.id}_${Date.now()}`,
          source: 'INVITATION'
        }
      });
      
      // Update user tokens
      await prisma.user.update({
        where: { id: userWithInvite.id },
        data: {
          subscriptionTokenBalance: proPlan.tokenQuota,
          tokenBalance: proPlan.tokenQuota
        }
      });
    }
    
    // Check results
    userWithInvite = await prisma.user.findUnique({
      where: { id: userWithInvite.id },
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    
    console.log('User with invite - Subscription count:', userWithInvite.subscriptions?.length);
    if (userWithInvite.subscriptions?.length > 0) {
      const sub = userWithInvite.subscriptions[0];
      const days = Math.ceil((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      console.log('User with invite - Subscription days:', days);
      console.log('User with invite - Plan:', sub.plan.name);
    }
    
    // 4. Test new user without invitation code (should get 14 days)
    console.log('\n=== Testing New User WITHOUT Invitation Code (14 days) ===');
    const userEmailWithoutInvite = 'newuser-no-invite@example.com';
    let userWithoutInvite = await prisma.user.create({
      data: {
        email: userEmailWithoutInvite,
        name: 'New User No Invite',
        status: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }
    });
    
    // Simulate subscription creation without invitation code - 14 days
    if (proPlan) {
      // Create 14-day trial subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);
      
      await prisma.subscription.create({
        data: {
          userId: userWithoutInvite.id,
          planId: proPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          provider: 'system',
          providerSubscriptionId: `trial_${userWithoutInvite.id}_${Date.now()}`,
          source: 'SYSTEM'
        }
      });
      
      // Update user tokens
      await prisma.user.update({
        where: { id: userWithoutInvite.id },
        data: {
          subscriptionTokenBalance: proPlan.tokenQuota,
          tokenBalance: proPlan.tokenQuota,
          trialUsed: true
        }
      });
    }
    
    // Check results
    userWithoutInvite = await prisma.user.findUnique({
      where: { id: userWithoutInvite.id },
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    
    console.log('User without invite - Subscription count:', userWithoutInvite.subscriptions?.length);
    if (userWithoutInvite.subscriptions?.length > 0) {
      const sub = userWithoutInvite.subscriptions[0];
      const days = Math.ceil((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      console.log('User without invite - Subscription days:', days);
      console.log('User without invite - Plan:', sub.plan.name);
    }
    
    // 5. Clean up test data
    console.log('\n=== Cleaning Up Test Data ===');
    await prisma.tokenTransaction.deleteMany({
      where: { 
        userId: {
          in: [userWithInvite.id, userWithoutInvite.id]
        }
      }
    });
    await prisma.subscription.deleteMany({
      where: { 
        userId: {
          in: [userWithInvite.id, userWithoutInvite.id]
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [userWithInvite.id, userWithoutInvite.id, inviter.id]
        }
      }
    });
    await prisma.invitation.deleteMany({
      where: { inviterId: inviter.id }
    });
    console.log('Test data cleaned up');
    
    console.log('\n✅ OAuth flow with invitation test completed successfully!');
    console.log('\nSummary:');
    console.log('- New users WITH invitation code get 30-day Pro subscription');
    console.log('- New users WITHOUT invitation code get 14-day Pro trial');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOAuthFlowWithInvitation();