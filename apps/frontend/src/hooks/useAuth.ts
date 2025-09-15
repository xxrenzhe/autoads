'use client'

import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { hasFeatureAccess, getFeatureAuthInfo, AUTH_FEATURES } from '@/lib/auth/auth-features'

export function useAuth() {
  const { data: session, status } = useSession()
  const [showLoginModal, setShowLoginModal] = useState(false)

  const isAuthenticated = !!session
  const isLoading = status === 'loading'
  const user = session?.user
  const userRole = user?.role as string

  /**
   * 检查是否有权限访问某个功能
   */
  const hasAccess = (featureId: string): boolean => {
    return hasFeatureAccess(featureId, userRole, isAuthenticated)
  }

  /**
   * 要求认证访问某个功能
   * 如果未认证，显示登录弹窗
   */
  const requireAuth = (featureId?: string): boolean => {
    if (isAuthenticated) {
      return true
    }

    if (featureId && !hasAccess(featureId)) {
      setShowLoginModal(true)
      return false
    }

    if (!isAuthenticated) {
      setShowLoginModal(true)
      return false
    }

    return true
  }

  /**
   * 检查功能访问权限并返回详细信息
   */
  const checkFeatureAccess = (featureId: string) => {
    const hasPermission = hasAccess(featureId)
    const featureInfo = getFeatureAuthInfo(featureId)
    
    return {
      hasAccess: hasPermission,
      requireAuth: featureInfo?.requireAuth || false,
      minRole: featureInfo?.minRole,
      featureName: featureInfo?.name,
      featureDescription: featureInfo?.description,
      userRole,
      isAuthenticated
    }
  }

  /**
   * 获取用户信息摘要
   */
  const getUserSummary = () => {
    if (!user) return null

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: userRole,
      emailVerified: user.emailVerified,
      // 可以添加更多用户相关信息
    }
  }

  /**
   * 检查是否是管理员
   */
  const isAdmin = (): boolean => {
    return ['ADMIN'].includes(userRole || '')
  }

  /**
   * 检查是否是超级管理员
   */
  const isSuperAdmin = (): boolean => {
    return false
  }

  /**
   * 检查是否是高级用户
   */
  const isPremium = (): boolean => {
    return ['PREMIUM', 'ADMIN'].includes(userRole || '')
  }

  return {
    // 基础状态
    isAuthenticated,
    isLoading,
    user,
    userRole,
    session,
    
    // 权限检查
    hasAccess,
    requireAuth,
    checkFeatureAccess,
    
    // 角色检查
    isAdmin,
    isSuperAdmin,
    isPremium,
    
    // 用户信息
    getUserSummary,
    
    // 登录弹窗控制
    showLoginModal,
    setShowLoginModal,
    openLoginModal: () => setShowLoginModal(true),
    closeLoginModal: () => setShowLoginModal(false),
    
    // 功能配置
    features: AUTH_FEATURES
  }
}

/**
 * 用于功能保护的Hook
 */
export function useFeatureGuard(featureId: string) {
  const auth = useAuth()
  const accessInfo = auth.checkFeatureAccess(featureId)
  
  return {
    ...accessInfo,
    requireAuth: () => auth.requireAuth(featureId),
    openLoginModal: auth.openLoginModal,
    showLoginModal: auth.showLoginModal,
    closeLoginModal: auth.closeLoginModal
  }
}
