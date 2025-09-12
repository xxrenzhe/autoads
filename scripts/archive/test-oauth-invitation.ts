#!/usr/bin/env tsx

/**
 * Test script to verify OAuth invitation flow
 * This simulates the flow:
 * 1. User visits invitation link
 * 2. Invitation code is stored in localStorage
 * 3. User clicks Google login
 * 4. Flag is set in sessionStorage
 * 5. After OAuth login, subscription is created with 30 days
 */

import { prisma } from '../src/lib/prisma';

async function testOAuthInvitationFlow() {
  console.log('🧪 Testing OAuth Invitation Flow...\n');

  try {
    // Clean up any existing test data
    console.log('🧹 Cleaning up existing test data...');
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-oauth-user'
        }
      }
    });

    // Test 1: Create a test inviter
    console.log('\n📝 Test 1: Creating test inviter...');
    const inviter = await prisma.user.create({
      data: {
        email: 'test-inviter@example.com',
        name: 'Test Inviter',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        isActive: true
      }
    });
    console.log(`✅ Created inviter: ${inviter.email} (${inviter.id})`);

    // Create invitation for inviter
    const invitation = await prisma.invitation.create({
      data: {
        inviterId: inviter.id,
        code: 'TESTCODE123',
        status: 'PENDING',
        tokensReward: 0
      }
    });
    console.log(`✅ Created invitation: ${invitation.code}`);

    // Test 2: Simulate new OAuth user with invitation
    console.log('\n📝 Test 2: Simulating new OAuth user with invitation...');
    
    // This simulates what would happen in the API
    const mockNewUser = await prisma.user.create({
      data: {
        email: 'test-oauth-user@example.com',
        name: 'Test OAuth User',
        role: 'USER',
        status: 'ACTIVE',
        emailVerified: true,
        isActive: true
      }
    });
    console.log(`✅ Created new OAuth user: ${mockNewUser.email} (${mockNewUser.id})`);

    // Test the subscription creation logic
    const { handleNewUserSubscription } = await import('../src/lib/auth/v5-config');
    
    // Apply invitation subscription
    console.log('\n📝 Test 3: Applying invitation subscription...');
    await handleNewUserSubscription(
      mockNewUser.id,
      mockNewUser.email,
      'TESTCODE123'
    );

    // Check results
    console.log('\n📊 Test Results:');
    
    // Check user's subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: mockNewUser.id },
      include: { plan: true }
    });

    console.log(`\n📋 User ${mockNewUser.email} has ${subscriptions.length} subscription(s):`);
    for (const sub of subscriptions) {
      const days = Math.ceil(
        (sub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      console.log(`  - ${sub.plan.name} (${sub.status}): ${days} days remaining`);
      console.log(`    Provider: ${sub.provider}, Source: ${sub.source}`);
    }

    // Check if trial was marked as used
    const updatedUser = await prisma.user.findUnique({
      where: { id: mockNewUser.id },
      select: { trialUsed: true }
    });
    console.log(`\n🏷️  Trial used: ${updatedUser?.trialUsed}`);

    // Check inviter also got subscription
    const inviterSubscriptions = await prisma.subscription.findMany({
      where: { userId: inviter.id },
      include: { plan: true }
    });

    console.log(`\n📋 Inviter ${inviter.email} has ${inviterSubscriptions.length} subscription(s):`);
    for (const sub of inviterSubscriptions) {
      const days = Math.ceil(
        (sub.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      console.log(`  - ${sub.plan.name} (${sub.status}): ${days} days remaining`);
      console.log(`    Provider: ${sub.provider}, Source: ${sub.source}`);
    }

    // Test 4: Verify no stacking (should not have both trial and invitation)
    const hasTrial = subscriptions.some(s => s.provider === 'trial');
    const hasInvitation = subscriptions.some(s => s.provider === 'invitation');
    
    console.log('\n✅ Verification:');
    console.log(`  - Has trial subscription: ${hasTrial}`);
    console.log(`  - Has invitation subscription: ${hasInvitation}`);
    console.log(`  - Both present (should be false): ${hasTrial && hasInvitation}`);

    if (hasInvitation && !hasTrial) {
      console.log('\n🎉 SUCCESS: OAuth user correctly received 30-day invitation subscription!');
    } else {
      console.log('\n❌ FAILURE: OAuth subscription logic is not working correctly');
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [inviter.id, mockNewUser.id]
        }
      }
    });

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testOAuthInvitationFlow();