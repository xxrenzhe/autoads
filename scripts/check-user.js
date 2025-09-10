import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const userEmail = 'yj2008ay611@gmail.com';
    
    // Get user with all related data
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        tokenTransactions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        tokenPurchases: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        },
        userRestrictions: {
          where: {
            isActive: true
          }
        },
        checkIns: {
          orderBy: {
            date: 'desc'
          },
          take: 5
        }
      }
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('=== USER INFO ===');
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Status:', user.status);
    console.log('isActive:', user.isActive);
    console.log('Role:', user.role);
    console.log('Email Verified:', user.emailVerified);
    console.log('Created At:', user.createdAt);
    console.log('Last Login At:', user.lastLoginAt);
    
    console.log('\n=== TOKEN BALANCES ===');
    console.log('Token Balance:', user.tokenBalance);
    console.log('Token Used This Month:', user.tokenUsedThisMonth);
    console.log('Activity Token Balance:', user.activityTokenBalance);
    console.log('Purchased Token Balance:', user.purchasedTokenBalance);
    console.log('Subscription Token Balance:', user.subscriptionTokenBalance);
    
    // Calculate total available tokens
    const totalTokens = user.tokenBalance + user.activityTokenBalance + user.purchasedTokenBalance + user.subscriptionTokenBalance;
    console.log('Total Available Tokens:', totalTokens);
    
    console.log('\n=== SUBSCRIPTIONS ===');
    if (user.subscriptions.length > 0) {
      user.subscriptions.forEach((sub, index) => {
        console.log(`\nSubscription ${index + 1}:`);
        console.log('  Plan:', sub.plan.name);
        console.log('  Status:', sub.status);
        console.log('  Current Period:', sub.currentPeriodStart, 'to', sub.currentPeriodEnd);
        console.log('  Cancel at Period End:', sub.cancelAtPeriodEnd);
        console.log('  Source:', sub.source);
      });
    } else {
      console.log('No subscriptions found');
    }
    
    console.log('\n=== RESTRICTIONS ===');
    if (user.userRestrictions.length > 0) {
      user.userRestrictions.forEach(restriction => {
        console.log(`Type: ${restriction.type}, Reason: ${restriction.reason}, Expires: ${restriction.expiresAt}`);
      });
    } else {
      console.log('No active restrictions');
    }
    
    console.log('\n=== RECENT TOKEN TRANSACTIONS ===');
    if (user.tokenTransactions.length > 0) {
      user.tokenTransactions.forEach(tx => {
        console.log(`${tx.createdAt}: ${tx.type} ${tx.amount > 0 ? '+' : ''}${tx.amount} (Balance: ${tx.balanceAfter}) - ${tx.description || 'No description'}`);
      });
    } else {
      console.log('No token transactions found');
    }
    
    console.log('\n=== RECENT TOKEN PURCHASES ===');
    if (user.tokenPurchases.length > 0) {
      user.tokenPurchases.forEach(purchase => {
        console.log(`${purchase.createdAt}: ${purchase.tokens} tokens for ${purchase.amount} ${purchase.currency} - Status: ${purchase.status}`);
      });
    } else {
      console.log('No token purchases found');
    }
    
    console.log('\n=== CHECK-INS ===');
    if (user.checkIns.length > 0) {
      user.checkIns.forEach(checkIn => {
        console.log(`${checkIn.date}: ${checkIn.tokens} tokens, Streak: ${checkIn.streak}`);
      });
    } else {
      console.log('No check-ins found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();