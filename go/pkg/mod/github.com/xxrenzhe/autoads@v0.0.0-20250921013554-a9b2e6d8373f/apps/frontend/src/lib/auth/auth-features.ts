/**
 * 认证功能配置
 * 管理哪些功能需要认证，以及相关的配置信息
 */

export interface AuthFeatureConfig {
  id: string
  name: string
  description: string
  requireAuth: boolean
  icon?: string
  category: 'core' | 'premium' | 'admin'
  minRole?: 'USER' | 'PREMIUM' | 'ADMIN'
}

export const AUTH_FEATURES: Record<string, AuthFeatureConfig> = {
  // 核心功能 - 页面可免登录访问，但操作需要登录
  batchopen: {
    id: 'batchopen',
    name: '批量打开URL',
    description: '智能批量访问，支持动态代理IP和自定义Referer',
    requireAuth: false, // 页面可访问
    icon: 'zap',
    category: 'core',
    minRole: 'USER'
  },
  
  siterank: {
    id: 'siterank',
    name: '网站排名分析',
    description: '专业SEO分析，洞察网站权威度和排名表现',
    requireAuth: false, // 页面可访问
    icon: 'shield',
    category: 'core',
    minRole: 'USER'
  },
  
  adscenter: {
    id: 'adscenter',
    name: '广告链接管理',
    description: '自动化广告投放，智能链接替换和管理',
    requireAuth: false, // 页面可访问
    icon: 'users',
    category: 'core',
    minRole: 'USER'
  },

  // 高级功能
  dashboard: {
    id: 'dashboard',
    name: '个人中心',
    description: '查看账户信息、使用统计和设置',
    requireAuth: true,
    icon: 'user',
    category: 'core',
    minRole: 'USER'
  },

  tokens: {
    id: 'tokens',
    name: 'Token管理',
    description: '查看和管理您的Token余额',
    requireAuth: true,
    icon: 'credit-card',
    category: 'premium',
    minRole: 'USER'
  },

  // 管理功能
  admin: {
    id: 'admin',
    name: '管理后台',
    description: '系统管理和用户管理功能',
    requireAuth: true,
    icon: 'settings',
    category: 'admin',
    minRole: 'ADMIN'
  }
}

/**
 * 检查用户是否有权限访问某个功能
 */
export function hasFeatureAccess(
  featureId: string, 
  userRole?: string, 
  isAuthenticated: boolean = false
): boolean {
  const feature = AUTH_FEATURES[featureId]
  
  if (!feature) {
    return false
  }

  // 如果功能不需要认证，直接允许
  if (!feature.requireAuth) {
    return true
  }

  // 如果需要认证但用户未登录，拒绝
  if (feature.requireAuth && !isAuthenticated) {
    return false
  }

  // 如果没有角色要求，已登录用户都可以访问
  if (!feature.minRole) {
    return isAuthenticated
  }

  // 检查角色权限
  const roleHierarchy = ['USER', 'PREMIUM', 'ADMIN']
  const userRoleIndex = roleHierarchy.indexOf(userRole || 'USER')
  const requiredRoleIndex = roleHierarchy.indexOf(feature.minRole)

  return userRoleIndex >= requiredRoleIndex
}

/**
 * 获取用户可访问的功能列表
 */
export function getUserAccessibleFeatures(
  userRole?: string, 
  isAuthenticated: boolean = false
): AuthFeatureConfig[] {
  return Object.values(AUTH_FEATURES).filter((feature: any) => 
    hasFeatureAccess(feature.id, userRole, isAuthenticated)
  )
}

/**
 * 获取功能的认证要求信息
 */
export function getFeatureAuthInfo(featureId: string) {
  const feature = AUTH_FEATURES[featureId]
  
  if (!feature) {
    return null
  }

  return {
    requireAuth: feature.requireAuth,
    minRole: feature.minRole,
    name: feature.name,
    description: feature.description,
    category: feature.category
  }
}

/**
 * 根据类别获取功能列表
 */
export function getFeaturesByCategory(category: 'core' | 'premium' | 'admin'): AuthFeatureConfig[] {
  return Object.values(AUTH_FEATURES).filter((feature: any) => feature.category === category)
}
