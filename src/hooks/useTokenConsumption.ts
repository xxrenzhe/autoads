import { useAuthContext } from '@/contexts/AuthContext'
import { useRequireAuth } from '@/contexts/AuthContext'

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
      
      const response = await fetch('/api/user/tokens/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          feature: featureUpper,
          operation,
          tokens,
          itemCount: options.itemCount,
          description: options.description,
          metadata: options.metadata
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 402) {
          options.onInsufficientBalance?.()
          return { success: false, error: 'Insufficient token balance' }
        }
        return { success: false, error: data.error || 'Failed to consume tokens' }
      }

      return {
        success: true,
        remainingBalance: data.remainingBalance,
        consumed: data.consumed
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