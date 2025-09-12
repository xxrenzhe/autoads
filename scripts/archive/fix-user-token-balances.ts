import { prisma } from '../src/lib/db';
import { TrialService } from '../src/lib/services/trial-service';

/**
 * Script to fix token balances for users who have active subscriptions but no tokens
 */

async function fixUserTokenBalances() {
  try {
    console.log('Starting to fix user token balances...');
    
    // Find all users with active subscriptions but no subscription tokens
    const usersWithActiveSubscriptions = await prisma.user.findMany({
      where: {
        subscriptions: {
          some: {
            status: 'ACTIVE',
            currentPeriodEnd: {
              gt: new Date()
            }
          }
        },
        OR: [
          {
            subscriptionTokenBalance: 0
          },
          {
            subscriptionTokenBalance: null
          }
        ]
      },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            currentPeriodEnd: {
              gt: new Date()
            }
          },
          include: {
            plan: true
          },
          orderBy: {
            currentPeriodEnd: 'desc'
          },
          take: 1
        }
      }
    });

    console.log(`Found ${usersWithActiveSubscriptions.length} users with active subscriptions but no tokens`);

    for (const user of usersWithActiveSubscriptions) {
      const activeSubscription = user.subscriptions[0];
      if (!activeSubscription) continue;

      const tokenQuota = activeSubscription.plan.tokenQuota || 10000;
      
      console.log(`Fixing user ${user.email} (${user.id}) with ${tokenQuota} tokens from ${activeSubscription.plan.name} plan`);

      // Update user's token balance
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionTokenBalance: {
            increment: tokenQuota
          },
          tokenBalance: {
            increment: tokenQuota
          }
        }
      });

      // Create token transaction record
      await prisma.tokenTransaction.create({
        data: {
          userId: user.id,
          type: 'SUBSCRIPTION',
          amount: tokenQuota,
          balanceBefore: user.subscriptionTokenBalance || 0,
          balanceAfter: (user.subscriptionTokenBalance || 0) + tokenQuota,
          source: 'system_fix',
          description: `System fix: Added missing subscription tokens for ${activeSubscription.plan.name} plan`,
          metadata: {
            subscriptionId: activeSubscription.id,
            planId: activeSubscription.plan.id,
            fixReason: 'missing_subscription_tokens',
            fixedAt: new Date().toISOString()
          }
        }
      });

      console.log(`✅ Fixed ${user.email}: Added ${tokenQuota} tokens`);
    }

    // Also check for users who have trial subscriptions but no tokens
    const usersWithTrialSubscriptions = await prisma.user.findMany({
      where: {
        subscriptions: {
          some: {
            status: 'ACTIVE',
            provider: 'trial',
            currentPeriodEnd: {
              gt: new Date()
            }
          }
        },
        subscriptionTokenBalance: {
          lt: 10000 // Trial should have at least 10000 tokens
        }
      },
      include: {
        subscriptions: {
          where: {
            status: 'ACTIVE',
            provider: 'trial'
          },
          include: {
            plan: true
          },
          take: 1
        }
      }
    });

    console.log(`\nFound ${usersWithTrialSubscriptions.length} users with trial subscriptions but insufficient tokens`);

    for (const user of usersWithTrialSubscriptions) {
      const trialSubscription = user.subscriptions[0];
      if (!trialSubscription) continue;

      const expectedTokens = 10000;
      const currentTokens = user.subscriptionTokenBalance || 0;
      const tokensToAdd = expectedTokens - currentTokens;

      if (tokensToAdd > 0) {
        console.log(`Topping up user ${user.email} (${user.id}) with ${tokensToAdd} additional trial tokens`);

        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionTokenBalance: expectedTokens,
            tokenBalance: {
              increment: tokensToAdd
            }
          }
        });

        await prisma.tokenTransaction.create({
          data: {
            userId: user.id,
            type: 'SUBSCRIPTION',
            amount: tokensToAdd,
            balanceBefore: currentTokens,
            balanceAfter: expectedTokens,
            source: 'system_fix',
            description: `System fix: Topped up trial tokens to expected amount`,
            metadata: {
              subscriptionId: trialSubscription.id,
              planId: trialSubscription.plan.id,
              fixReason: 'insufficient_trial_tokens',
              fixedAt: new Date().toISOString()
            }
          }
        });

        console.log(`✅ Topped up ${user.email}: Added ${tokensToAdd} tokens (total: ${expectedTokens})`);
      }
    }

    console.log('\n✅ Token balance fix completed successfully!');
    
  } catch (error) {
    console.error('Error fixing user token balances:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixUserTokenBalances();