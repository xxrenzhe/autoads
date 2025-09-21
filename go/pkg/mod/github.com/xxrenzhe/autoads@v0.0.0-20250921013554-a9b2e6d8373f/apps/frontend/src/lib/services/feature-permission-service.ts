import { prisma } from '@/lib/prisma';
import { PermissionService } from './permission-service';

export interface FeaturePermission {
  featureId: string;
  name: string;
  description: string;
  requiredPlan: string; // free, pro, max
  requiredPermissions: string[];
  limits?: Record<string, any>;
}

export class FeaturePermissionService {
  // 功能权限映射
  private static readonly FEATURE_PERMISSIONS: FeaturePermission[] = [
    // SiteRank功能
    {
      featureId: 'siterank_basic',
      name: '网站排名基础版',
      description: '基础网站排名查询功能',
      requiredPlan: 'free',
      requiredPermissions: ['siterank:read'],
      limits: {
        batchLimit: 10,
        tokensPerQuery: 1
      }
    },
    {
      featureId: 'siterank_pro',
      name: '网站排名专业版',
      description: '高级网站排名查询功能',
      requiredPlan: 'pro',
      requiredPermissions: ['siterank:read'],
      limits: {
        batchLimit: 100,
        tokensPerQuery: 1
      }
    },
    {
      featureId: 'siterank_max',
      name: '网站排名企业版',
      description: '企业级网站排名查询功能',
      requiredPlan: 'max',
      requiredPermissions: ['siterank:read'],
      limits: {
        batchLimit: 1000,
        tokensPerQuery: 1
      }
    },
    
    // BatchOpen功能
    {
      featureId: 'batchopen_basic',
      name: '批量打开基础版',
      description: '基础批量URL打开功能',
      requiredPlan: 'free',
      requiredPermissions: ['batchopen:read'],
      limits: {
        maxUrlsPerBatch: 20,
        tokensPerUrl: 1,
        versions: ['basic', 'silent']
      }
    },
    {
      featureId: 'batchopen_pro',
      name: '批量打开专业版',
      description: '高级批量URL打开功能',
      requiredPlan: 'pro',
      requiredPermissions: ['batchopen:read'],
      limits: {
        maxUrlsPerBatch: 200,
        tokensPerUrl: 1,
        versions: ['basic', 'silent', 'autoclick', 'automated']
      }
    },
    {
      featureId: 'batchopen_max',
      name: '批量打开企业版',
      description: '企业级批量URL打开功能',
      requiredPlan: 'max',
      requiredPermissions: ['batchopen:read'],
      limits: {
        maxUrlsPerBatch: 1000,
        tokensPerUrl: 1,
        versions: ['basic', 'silent', 'autoclick', 'automated']
      }
    },
    
    // AdsCenter 功能
    {
      featureId: 'adscenter_basic',
      name: '自动化广告基础版',
      description: '基础广告自动化管理',
      requiredPlan: 'pro',
      requiredPermissions: ['adscenter:read'],
      limits: {
        maxCampaigns: 5,
        maxAccounts: 5,
        tokensPerExecution: 5
      }
    },
    {
      featureId: 'adscenter_max',
      name: '自动化广告企业版',
      description: '企业级广告自动化管理',
      requiredPlan: 'max',
      requiredPermissions: ['adscenter:read'],
      limits: {
        maxCampaigns: 20,
        maxAccounts: 20,
        tokensPerExecution: 5
      }
    },
    
    // API访问功能
    {
      featureId: 'api_access',
      name: 'API访问',
      description: '通过API使用服务',
      requiredPlan: 'free',
      requiredPermissions: ['api:read'],
      limits: {
        rateLimit: 100
      }
    },
    {
      featureId: 'api_access_pro',
      name: 'API访问专业版',
      description: '高级API访问功能',
      requiredPlan: 'pro',
      requiredPermissions: ['api:read'],
      limits: {
        rateLimit: 1000
      }
    },
    {
      featureId: 'api_access_max',
      name: 'API访问企业版',
      description: '企业级API访问功能',
      requiredPlan: 'max',
      requiredPermissions: ['api:read'],
      limits: {
        rateLimit: 5000
      }
    }
  ];

  /**
   * 检查用户是否有权访问特定功能
   */
  static async checkFeatureAccess(
    userId: string,
    featureId: string
  ): Promise<{
    hasAccess: boolean;
    reason?: string;
    limits?: Record<string, any>;
    feature?: FeaturePermission;
  }> {
    try {
      // 1. 获取功能定义
      const feature = this.FEATURE_PERMISSIONS.find((f: any) => f.featureId === featureId);
      if (!feature) {
        return { hasAccess: false, reason: 'Feature not found' };
      }

      // 2. 检查基础权限
      const hasPermission = await Promise.all(
        feature.requiredPermissions.map((permission: any) => {
          const [resource, action] = permission.split(':');
          return PermissionService.hasPermission(userId, resource, action);
        })
      );

      if (!hasPermission.every(p => p)) {
        return { hasAccess: false, reason: 'Insufficient permissions' };
      }

      // 3. 获取用户订阅信息
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          currentPeriodEnd: { gt: new Date() }
        },
        include: {
          plan: {
            include: {
              planFeatures: true
            }
          }
        }
      });

      if (!subscription) {
        return { hasAccess: false, reason: 'No active subscription' };
      }

      // 4. 检查套餐级别和功能是否启用
      const planHierarchy = { free: 0, pro: 1, max: 2 };
      const userPlanLevel = planHierarchy[subscription.plan.name.toLowerCase() as keyof typeof planHierarchy] || 0;
      const requiredPlanLevel = planHierarchy[feature.requiredPlan as keyof typeof planHierarchy];

      if (userPlanLevel < requiredPlanLevel) {
        return { 
          hasAccess: false, 
          reason: `Feature requires ${feature.requiredPlan} plan or higher` 
        };
      }

      // 5. 获取套餐功能
      const planFeatures = subscription.plan.features as any || {};

      // 7. 检查功能是否在套餐中启用（使用 PlanFeature 表）
      const featureCategory = featureId.split('_')[0]; // siterank, batchopen, adscenter
      let featureEnabled = false;
      
      // 根据功能类别检查对应的 PlanFeature
      switch (featureCategory) {
        case 'siterank':
          featureEnabled = subscription.plan.planFeatures?.some((f: any) => 
            f.featureName.startsWith('WEBSITE_RANKING') && f.enabled
          ) || false;
          break;
        case 'batchopen':
          featureEnabled = subscription.plan.planFeatures?.some((f: any) => 
            f.featureName.startsWith('REAL_CLICK') && f.enabled
          ) || false;
          break;
        case 'adscenter':
          featureEnabled = subscription.plan.planFeatures?.some((f: any) => 
            f.featureName.startsWith('AUTOMATED_ADS') && f.enabled
          ) || false;
          break;
        default:
          featureEnabled = false;
      }
      
      if (!featureEnabled) {
        return { hasAccess: false, reason: 'Feature not included in current plan' };
      }

      // 8. 获取自定义限制（如果有）
      const limits = {
        ...feature.limits,
        ...(planFeatures[featureId.split('_')[0]]?.limits || {})
      };

      return {
        hasAccess: true,
        limits,
        feature
      };
    } catch (error) {
      console.error('Feature access check failed:', error);
      return { hasAccess: false, reason: 'Internal error' };
    }
  }

  /**
   * 获取用户可访问的所有功能
   */
  static async getUserFeatures(userId: string): Promise<{
    features: FeaturePermission[];
    limits: Record<string, any>;
  }> {
    const accessibleFeatures: FeaturePermission[] = [];
    const limits: Record<string, any> = {};

    // 获取用户订阅
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: { gt: new Date() }
      },
      include: {
        plan: true
      }
    });

    if (!subscription) {
      return { features: [], limits: {} };
    }

    const planFeatures = subscription.plan.features as any || {};

    // 检查每个功能
    for (const feature of this.FEATURE_PERMISSIONS) {
      const access = await this.checkFeatureAccess(userId, feature.featureId);
      if (access.hasAccess) {
        accessibleFeatures.push(feature);
        limits[feature.featureId] = access.limits;
      }
    }

    return { features: accessibleFeatures, limits };
  }

  /**
   * 获取功能权限中间件
   */
  static requireFeature(featureId: string) {
    return async function (userId: string): Promise<{
      authorized: boolean;
      reason?: string;
      limits?: Record<string, any>;
    }> {
      const result = await FeaturePermissionService.checkFeatureAccess(userId, featureId);
      return {
        authorized: result.hasAccess,
        reason: result.reason,
        limits: result.limits
      };
    };
  }

  /**
   * 批量检查功能权限
   */
  static async checkMultipleFeatures(
    userId: string,
    featureIds: string[]
  ): Promise<Record<string, {
    hasAccess: boolean;
    reason?: string;
    limits?: Record<string, any>;
  }>> {
    const results: Record<string, any> = {};

    for (const featureId of featureIds) {
      results[featureId] = await this.checkFeatureAccess(userId, featureId);
    }

    return results;
  }

  /**
   * 获取所有功能定义（用于管理后台）
   */
  static getAllFeatures(): FeaturePermission[] {
    return [...this.FEATURE_PERMISSIONS];
  }

  /**
   * 根据套餐ID获取可用功能
   */
  static getFeaturesByPlan(planId: string): FeaturePermission[] {
    const planHierarchy = { free: 0, pro: 1, max: 2 };
    const planLevel = planHierarchy[planId as keyof typeof planHierarchy] || 0;

    return this.FEATURE_PERMISSIONS.filter((feature: any) => {
      const requiredLevel = planHierarchy[feature.requiredPlan as keyof typeof planHierarchy];
      return planLevel >= requiredLevel;
    });
  }
}
