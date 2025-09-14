import { useAuthContext } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/contexts/AuthContext'
import { http } from '@/shared/http/client'

/**
 * 使用Token消耗的Hook
 */
export function useTokenConsumption() {
  const { isAuthenticated, user } = useAuthContext()
  const { requireAuth } = useRequireAuth()

  /**
   * 消耗Token
   * @param feature 功能名称
   * @param operation 操作名称
   * @param tokens 消耗的Token数量
   * @param options 其他选项
   * @returns Promise<{success: boolean, remainingBalance?: number, error?: string}>
   */
  const consumeTokens = async (
    feature: 'batchopen' | 'siterank' | 'adscenter',
    operation: string,
    tokens: number,
    options: {
      itemCount?: number
      description?: string
      metadata?: Record<string, any>
      onInsufficientBalance?: () => void
      onAuthRequired?: () => void
    } = {}
  ) => {
    // 检查认证
    if (!requireAuth()) {
      options.onAuthRequired?.()
      return { success: false, error: 'Authentication required' }
    }

    try {
      // Convert feature to uppercase for API compatibility
      const featureUpper = feature.toUpperCase() as 'BATCHOPEN' | 'SITERANK' | 'CHANGELINK'
      
      try {
        const data = await http.post<{ success: true; remainingBalance: number; consumed: number } | { error: string }>(
          '/user/tokens/consume',
          {
            feature: featureUpper,
            operation,
            tokens,
            itemCount: options.itemCount,
            description: options.description,
            metadata: options.metadata
          }
        )

        // API returns success: true when OK
        if ((data as any).success !== true) {
          return { success: false, error: (data as any)?.error || 'Failed to consume tokens' }
        }

        return {
          success: true,
          remainingBalance: (data as any).remainingBalance,
          consumed: (data as any).consumed
        }
      } catch (err: any) {
        if (err?.status === 402) {
          options.onInsufficientBalance?.()
          return { success: false, error: 'Insufficient token balance' }
        }
        return { success: false, error: err?.details?.error || 'Failed to consume tokens' }
      }
    } catch (error) {
      console.error('Token consumption error:', error)
      return { success: false, error: 'Network error' }
    }
  }

  /**
   * 检查是否有足够的Token
   */
  const hasEnoughTokens = (requiredTokens: number): boolean => {
    return (user?.tokenBalance || 0) >= requiredTokens
  }

  /**
   * 获取Token余额
   */
  const getTokenBalance = (): number => {
    return user?.tokenBalance || 0
  }

  return {
    consumeTokens,
    hasEnoughTokens,
    getTokenBalance,
    isAuthenticated
  }
}
