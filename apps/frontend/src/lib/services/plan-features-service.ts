import { prisma } from '@/lib/prisma';

/**
 * Standardized plan features management
 */
export class PlanFeaturesService {
  /**
   * Standard feature definitions
   */
  static readonly STANDARD_FEATURES = {
    // Core features
    API_ACCESS: {
      name: 'API访问',
      description: '通过API使用服务',
      category: 'core',
      type: 'boolean'
    },
    WEB_DASHBOARD: {
      name: 'Web控制台',
      description: '访问Web管理界面',
      category: 'core',
      type: 'boolean'
    },
    
    // Real Click features
    REAL_CLICK_BASIC: {
      name: '真实点击-基础版',
      description: '真实点击功能（初级版本）',
      category: 'real_click',
      type: 'boolean'
    },
    REAL_CLICK_SILENT: {
      name: '真实点击-静默版',
      description: '真实点击功能（静默版本）',
      category: 'real_click',
      type: 'boolean'
    },
    REAL_CLICK_AUTOMATED: {
      name: '真实点击-自动化版',
      description: '真实点击功能（自动化版本）',
      category: 'real_click',
      type: 'boolean'
    },
    
    // Website Ranking features
    WEBSITE_RANKING: {
      name: '网站排名',
      description: '网站排名查询功能',
      category: 'website_ranking',
      type: 'boolean'
    },
    WEBSITE_RANKING_BATCH_LIMIT: {
      name: '网站排名批量查询上限',
      description: '单次批量查询域名数量限制',
      category: 'website_ranking',
      type: 'number',
      unit: '个/次'
    },
    
    // Automated Ads features
    AUTOMATED_ADS: {
      name: '自动化广告',
      description: '自动化广告管理功能',
      category: 'automated_ads',
      type: 'boolean'
    },
    ADS_ACCOUNT_LIMIT: {
      name: 'Ads账号管理上限',
      description: '批量管理Ads账号数量限制',
      category: 'automated_ads',
      type: 'number',
      unit: '个'
    },
    
    // Token features
    TOKEN_QUOTA: {
      name: 'Token配额',
      description: '每月获得的Token数量',
      category: 'tokens',
      type: 'number',
      unit: '个'
    }
  };

  /**
   * Get all standard features
   */
  static getAllStandardFeatures() {
    return Object.entries(this.STANDARD_FEATURES).map(([key, feature]: any) => ({
      id: key,
      ...feature
    }));
  }

  /**
   * Get features by category
   */
  static getFeaturesByCategory(category: string) {
    return Object.entries(this.STANDARD_FEATURES)
      .filter(([_, feature]: any) => feature.category === category)
      .map(([key, feature]: any) => ({
        id: key,
        ...feature
      }));
  }

  /**
   * Create standardized features for a plan
   */
  static async createPlanFeatures(planId: string, featuresConfig: Record<string, any>) {
    const features = [];
    
    for (const [featureKey, config] of Object.entries(featuresConfig)) {
      const standardFeature = this.STANDARD_FEATURES[featureKey as keyof typeof this.STANDARD_FEATURES];
      
      if (!standardFeature) {
        console.warn(`Unknown feature: ${featureKey}`);
        continue;
      }

      const feature = await prisma.planFeature.create({
        data: {
          planId,
          featureName: featureKey,
          enabled: config.enabled ?? true,
          limit: typeof config.value === 'number' ? config.value : null,
          metadata: {
            name: standardFeature.name,
            description: standardFeature.description,
            unit: (standardFeature as any).unit || undefined,
            type: standardFeature.type,
            value: config.value,
            ...config.additionalConfig
          }
        }
      });

      features.push(feature);
    }

    return features;
  }

  /**
   * Update plan features
   */
  static async updatePlanFeatures(planId: string, featuresConfig: Record<string, any>) {
    const results = [];
    
    for (const [featureKey, config] of Object.entries(featuresConfig)) {
      const standardFeature = this.STANDARD_FEATURES[featureKey as keyof typeof this.STANDARD_FEATURES];
      
      if (!standardFeature) {
        console.warn(`Unknown feature: ${featureKey}`);
        continue;
      }

      const feature = await prisma.planFeature.upsert({
        where: {
          planId_featureName: {
            planId,
            featureName: featureKey
          }
        },
        update: {
          enabled: config.enabled ?? true,
          limit: typeof config.value === 'number' ? config.value : null,
          metadata: {
            name: standardFeature.name,
            description: standardFeature.description,
            unit: (standardFeature as any).unit || undefined,
            type: standardFeature.type,
            value: config.value,
            ...config.additionalConfig
          }
        },
        create: {
          planId,
          featureName: featureKey,
          enabled: config.enabled ?? true,
          limit: typeof config.value === 'number' ? config.value : null,
          metadata: {
            name: standardFeature.name,
            description: standardFeature.description,
            unit: (standardFeature as any).unit || undefined,
            type: standardFeature.type,
            value: config.value,
            ...config.additionalConfig
          }
        }
      });

      results.push(feature);
    }

    return results;
  }

  /**
   * Get plan features with values
   */
  static async getPlanFeatures(planId: string) {
    const features = await prisma.planFeature.findMany({
      where: { planId },
      orderBy: { createdAt: 'asc' }
    });

    return features.map((feature: any: any) => ({
      id: feature.featureName,
      name: feature.metadata?.name,
      description: feature.metadata?.description,
      enabled: feature.enabled,
      value: feature.metadata?.value ?? feature.limit,
      unit: feature.metadata?.unit,
      type: feature.metadata?.type,
      limit: feature.limit,
      additionalConfig: feature.metadata
    }));
  }

  /**
   * Check if plan has a specific feature
   */
  static async hasFeature(planId: string, featureId: string): Promise<boolean> {
    const feature = await prisma.planFeature.findUnique({
      where: {
        planId_featureName: {
          planId,
          featureName: featureId
        }
      }
    });

    return feature?.enabled ?? false;
  }

  /**
   * Get feature value for a plan
   */
  static async getFeatureValue(planId: string, featureId: string) {
    const feature = await prisma.planFeature.findUnique({
      where: {
        planId_featureName: {
          planId,
          featureName: featureId
        }
      }
    });

    return feature?.metadata?.value ?? feature?.limit;
  }

  /**
   * Initialize default plans with standardized features
   */
  static async initializeDefaultPlans() {
    // Check if plans exist first
    const existingPlans = await prisma.plan.findMany({
      where: {
        name: {
          in: ['free', 'pro', 'max']
        }
      }
    });

    // Free Plan (免费套餐)
    const freePlan = existingPlans.find((p: any: any) => p.name === 'free') || await prisma.plan.create({
      data: {
        name: 'free',
        description: '免费套餐',
        price: 0,
        currency: 'CNY',
        interval: 'MONTH',
        status: 'ACTIVE',
        sortOrder: 0,
        tokenQuota: 1000,
        tokenReset: 'MONTHLY',
        rateLimit: 10
      }
    });

    // Pro Plan (高级套餐)
    const proPlan = existingPlans.find((p: any: any) => p.name === 'pro') || await prisma.plan.create({
      data: {
        name: 'pro',
        description: '高级套餐',
        price: 298,
        currency: 'CNY',
        interval: 'MONTH',
        status: 'ACTIVE',
        sortOrder: 1,
        tokenQuota: 10000,
        tokenReset: 'MONTHLY',
        rateLimit: 100
      }
    });

    // Max Plan (白金套餐)
    const maxPlan = existingPlans.find((p: any: any) => p.name === 'max') || await prisma.plan.create({
      data: {
        name: 'max',
        description: '白金套餐',
        price: 998,
        currency: 'CNY',
        interval: 'MONTH',
        status: 'ACTIVE',
        sortOrder: 2,
        tokenQuota: 100000,
        tokenReset: 'MONTHLY',
        rateLimit: 500
      }
    });

    // Create features for each plan based on requirements
    
    // Free Plan features
    const freeFeatures = {
      API_ACCESS: { enabled: true },
      WEB_DASHBOARD: { enabled: true },
      REAL_CLICK_BASIC: { enabled: true },
      REAL_CLICK_SILENT: { enabled: true },
      REAL_CLICK_AUTOMATED: { enabled: false },
      WEBSITE_RANKING: { enabled: true },
      WEBSITE_RANKING_BATCH_LIMIT: { enabled: true, value: 100 },
      AUTOMATED_ADS: { enabled: false },
      ADS_ACCOUNT_LIMIT: { enabled: false, value: 0 },
      TOKEN_QUOTA: { enabled: true, value: 1000 }
    };

    // Pro Plan features
    const proFeatures = {
      API_ACCESS: { enabled: true },
      WEB_DASHBOARD: { enabled: true },
      REAL_CLICK_BASIC: { enabled: true },
      REAL_CLICK_SILENT: { enabled: true },
      REAL_CLICK_AUTOMATED: { enabled: true }, // 自动化版本
      WEBSITE_RANKING: { enabled: true },
      WEBSITE_RANKING_BATCH_LIMIT: { enabled: true, value: 500 },
      AUTOMATED_ADS: { enabled: true },
      ADS_ACCOUNT_LIMIT: { enabled: true, value: 10 },
      TOKEN_QUOTA: { enabled: true, value: 10000 }
    };

    // Max Plan features
    const maxFeatures = {
      API_ACCESS: { enabled: true },
      WEB_DASHBOARD: { enabled: true },
      REAL_CLICK_BASIC: { enabled: true },
      REAL_CLICK_SILENT: { enabled: true },
      REAL_CLICK_AUTOMATED: { enabled: true },
      WEBSITE_RANKING: { enabled: true },
      WEBSITE_RANKING_BATCH_LIMIT: { enabled: true, value: 5000 },
      AUTOMATED_ADS: { enabled: true },
      ADS_ACCOUNT_LIMIT: { enabled: true, value: 100 },
      TOKEN_QUOTA: { enabled: true, value: 100000 }
    };

    await this.createPlanFeatures(freePlan.id, freeFeatures);
    await this.createPlanFeatures(proPlan.id, proFeatures);
    await this.createPlanFeatures(maxPlan.id, maxFeatures);

    console.log('Initialized default plans with standardized features');
  }

  /**
   * Compare two plans and show differences
   */
  static async comparePlans(planId1: string, planId2: string) {
    const [features1, features2] = await Promise.all([
      this.getPlanFeatures(planId1),
      this.getPlanFeatures(planId2)
    ]);

    const differences = [];
    const allFeatureIds = new Set([
      ...features1.map((f: any: any) => f.id),
      ...features2.map((f: any: any) => f.id)
    ]);

    for (const featureId of allFeatureIds) {
      const feat1 = features1.find((f: any: any) => f.id === featureId);
      const feat2 = features2.find((f: any: any) => f.id === featureId);

      differences.push({
        featureId,
        name: feat1?.name || feat2?.name,
        plan1: feat1 ? {
          enabled: feat1.enabled,
          value: feat1.value,
          unit: feat1.unit
        } : null,
        plan2: feat2 ? {
          enabled: feat2.enabled,
          value: feat2.value,
          unit: feat2.unit
        } : null
      });
    }

    return differences;
  }
}