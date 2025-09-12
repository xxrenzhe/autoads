import { prisma } from '../src/lib/db';

async function testSubscriptionMetadata() {
  try {
    console.log('Testing subscription metadata field...\n');

    // Test 1: Query subscription with metadata
    console.log('1. Testing subscription query with metadata...');
    const subscription = await prisma.subscription.findFirst({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gt: new Date()
        }
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (subscription) {
      console.log(`✅ Found subscription: ${subscription.id}`);
      console.log(`   Plan: ${subscription.plan.name}`);
      console.log(`   User: ${subscription.user.email}`);
      console.log(`   Metadata:`, subscription.metadata || 'null');
    } else {
      console.log('ℹ️  No active subscriptions found');
    }

    // Test 2: Update subscription metadata
    console.log('\n2. Testing metadata update...');
    if (subscription) {
      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          metadata: {
            test: 'test-value',
            updatedAt: new Date().toISOString(),
            source: 'test-script'
          }
        }
      });
      
      console.log(`✅ Updated metadata for subscription ${subscription.id}`);
      console.log(`   New metadata:`, updated.metadata);
    }

    // Test 3: Query user with subscriptions including metadata
    console.log('\n3. Testing user query with subscription metadata...');
    const userWithSubscription = await prisma.user.findFirst({
      where: {
        subscriptions: {
          some: {
            status: 'ACTIVE'
          }
        }
      },
      select: {
        id: true,
        email: true,
        subscriptions: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            plan: true
          },
          take: 1
        }
      }
    });

    if (userWithSubscription) {
      console.log(`✅ Found user with subscription: ${userWithSubscription.email}`);
      const sub = userWithSubscription.subscriptions[0];
      console.log(`   Subscription metadata:`, sub.metadata || 'null');
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testSubscriptionMetadata();