import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import UserCenter from '@/components/user/UserCenter';

/**
 * Convert PlanFeature data to the legacy features format expected by components
 */
function convertPlanFeaturesToLegacyFormat(planFeatures: any[]) {
  const features: any = {
    siterank: { enabled: false },
    batchopen: { enabled: false },
    adscenter: { enabled: false }
  };

  planFeatures.forEach(feature => {
    const value = feature.metadata?.value ?? feature.limit;
    
    switch (feature.featureName) {
      case 'WEBSITE_RANKING':
        features.siterank = {
          enabled: feature.enabled,
          maxQueriesPerBatch: value || 100
        };
        break;
        
      case 'WEBSITE_RANKING_BATCH_LIMIT':
        if (features.siterank.enabled) {
          features.siterank.maxQueriesPerBatch = value || 100;
        }
        break;
        
      case 'REAL_CLICK_BASIC':
      case 'REAL_CLICK_SILENT':
        if (!features.batchopen.enabled) {
          features.batchopen = { enabled: feature.enabled };
        }
        break;
        
      case 'REAL_CLICK_AUTOMATED':
        features.batchopen = {
          enabled: feature.enabled,
          maxUrlsPerBatch: 500, // Default value
          proxyRotation: feature.enabled
        };
        break;
        
      case 'AUTOMATED_ADS':
        features.adscenter = {
          enabled: feature.enabled,
          maxAccountsManaged: value || 5
        };
        break;
        
      case 'ADS_ACCOUNT_LIMIT':
        if (features.adscenter.enabled) {
          features.adscenter.maxAccountsManaged = value || 5;
        }
        break;
    }
  });

  return features;
}

async function getUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      tokenBalance: true,
      subscriptionTokenBalance: true,
      activityTokenBalance: true,
      purchasedTokenBalance: true,
      subscriptions: {
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: { gt: new Date() }
        },
        include: {
          plan: {
            include: {
              planFeatures: true
            }
          }
        },
        orderBy: {
          currentPeriodEnd: 'desc'
        },
        take: 1
      }
    }
  });

  // Calculate total token balance
  // Use the new detailed balances if available, otherwise fall back to legacy tokenBalance
  if (user) {
    const newBalanceTotal = (user.subscriptionTokenBalance || 0) + 
                           (user.activityTokenBalance || 0) + 
                           (user.purchasedTokenBalance || 0);
    const totalBalance = newBalanceTotal > 0 ? newBalanceTotal : (user.tokenBalance || 0);
    
    return {
      ...user,
      totalTokenBalance: totalBalance
    };
  }

  return user;
}

export default async function UserCenterPage() {
  const session = await auth();
  
  if (!session?.userId) {
    // For SSR, we'll pass no user data and let the component handle the login state
    return <UserCenter />;
  }

  const user = await getUserData(session.userId);

  // Transform the user data to match the expected interface
  const transformedUser = user ? {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    status: user.status,
    createdAt: user.createdAt?.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString(),
    tokenBalance: user.tokenBalance,
    subscriptionTokenBalance: user.subscriptionTokenBalance,
    activityTokenBalance: user.activityTokenBalance,
    purchasedTokenBalance: user.purchasedTokenBalance,
    totalTokenBalance: user.totalTokenBalance,
    subscription: user.subscriptions[0] ? {
      id: user.subscriptions[0].id,
      status: user.subscriptions[0].status,
      currentPeriodStart: user.subscriptions[0].currentPeriodStart,
      currentPeriodEnd: user.subscriptions[0].currentPeriodEnd,
      provider: user.subscriptions[0].provider,
      plan: {
        id: user.subscriptions[0].plan.id,
        name: user.subscriptions[0].plan.name,
        description: user.subscriptions[0].plan.description || '',
        price: user.subscriptions[0].plan.price,
        tokenQuota: user.subscriptions[0].plan.tokenQuota,
        features: convertPlanFeaturesToLegacyFormat(user.subscriptions[0].plan.planFeatures || [])
      }
    } : null
  } : undefined;

  return <UserCenter user={transformedUser} />;
}