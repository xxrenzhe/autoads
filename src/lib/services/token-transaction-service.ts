import { prisma } from '@/lib/prisma'
import { $Enums } from '@prisma/client';

type TokenType = $Enums.TokenType;

export interface TokenTransactionRecord {
  id: string
  userId: string
  type: TokenType
  amount: number
  balanceBefore: number
  balanceAfter: number
  source: string
  description?: string
  metadata?: any
  createdAt: Date
}

export interface TokenTransactionFilter {
  userId?: string
  type?: TokenType | TokenType[]
  source?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
  includeMetadata?: boolean
}

export interface TokenTransactionStats {
  totalTransactions: number
  totalAcquired: number
  totalConsumed: number
  byType: Record<TokenType, { acquired: number; consumed: number }>
  bySource: Record<string, number>
  recentTransactions: TokenTransactionRecord[]
}

export interface TokenBalanceHistory {
  date: string
  balance: number
  change: number
}

export class TokenTransactionService {
  /**
   * Record a token transaction
   */
  static async recordTransaction(params: {
    userId: string
    type: TokenType
    amount: number
    balanceBefore: number
    balanceAfter: number
    source: string
    description?: string
    metadata?: any
  }): Promise<TokenTransactionRecord> {
    try {
      const transaction = await prisma.tokenTransaction.create({
        data: {
          userId: params.userId,
          type: params.type,
          amount: params.amount,
          balanceBefore: params.balanceBefore,
          balanceAfter: params.balanceAfter,
          source: params.source,
          description: params.description,
          metadata: params.metadata
        }
      })

      return {
        id: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        source: transaction.source,
        description: transaction.description,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt
      }
    } catch (error) {
      console.error('Failed to record token transaction:', error)
      throw error
    }
  }

  /**
   * Get user's token transaction history
   */
  static async getUserTransactions(
    userId: string,
    filter: Omit<TokenTransactionFilter, 'userId'> = {}
  ): Promise<{
    transactions: TokenTransactionRecord[]
    total: number
    page: number
    totalPages: number
  }> {
    try {
      const {
        type,
        source,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        includeMetadata = false
      } = filter

      const whereClause: any = { userId }

      if (type) {
        whereClause.type = Array.isArray(type) ? { in: type } : type
      }

      if (source) {
        whereClause.source = source
      }

      if (startDate || endDate) {
        whereClause.createdAt = {}
        if (startDate) whereClause.createdAt.gte = startDate
        if (endDate) whereClause.createdAt.lte = endDate
      }

      const [transactions, total] = await Promise.all([
        prisma.tokenTransaction.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            userId: true,
            type: true,
            amount: true,
            balanceBefore: true,
            balanceAfter: true,
            source: true,
            description: true,
            metadata: includeMetadata,
            createdAt: true
          }
        }),
        prisma.tokenTransaction.count({ where: whereClause })
      ])

      return {
        transactions: transactions as TokenTransactionRecord[],
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    } catch (error) {
      console.error('Failed to get user transactions:', error)
      return {
        transactions: [],
        total: 0,
        page: 1,
        totalPages: 0
      }
    }
  }

  /**
   * Get token transaction statistics
   */
  static async getTransactionStats(
    userId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<TokenTransactionStats> {
    try {
      const whereClause: any = { userId }
      
      if (timeRange) {
        whereClause.createdAt = {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }

      const [transactions, typeStats, sourceStats] = await Promise.all([
        // Get recent transactions
        prisma.tokenTransaction.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: 10
        }),

        // Get stats by token type
        prisma.tokenTransaction.groupBy({
          by: ['type'],
          where: whereClause,
          _sum: { amount: true },
          _count: true
        }),

        // Get stats by source
        prisma.tokenTransaction.groupBy({
          by: ['source'],
          where: whereClause,
          _sum: { amount: true },
          _count: true
        })
      ])

      // Calculate totals
      const totalAcquired = transactions
        .filter((t: { amount: number }) => t.amount > 0)
        .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)

      const totalConsumed = Math.abs(
        transactions
          .filter((t: { amount: number }) => t.amount < 0)
          .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)
      )

      // Initialize type stats
      const byType: Record<TokenType, { acquired: number; consumed: number }> = {
        FREE: { acquired: 0, consumed: 0 },
        SUBSCRIPTION: { acquired: 0, consumed: 0 },
        PURCHASED: { acquired: 0, consumed: 0 },
        ACTIVITY: { acquired: 0, consumed: 0 },
        BONUS: { acquired: 0, consumed: 0 },
        }

      // Fill type stats
      typeStats.forEach((stat: { type: string; _sum: { amount: number | null } }) => {
        const amount = stat._sum.amount || 0
        if (amount > 0) {
          byType[stat.type as TokenType].acquired = amount
        } else {
          byType[stat.type as TokenType].consumed = Math.abs(amount)
        }
      })

      // Fill source stats
      const bySource: Record<string, number> = {}
      sourceStats.forEach((stat: { source: string; _sum: { amount: number | null } }) => {
        bySource[stat.source] = Math.abs(stat._sum.amount || 0)
      })

      return {
        totalTransactions: transactions.length,
        totalAcquired,
        totalConsumed,
        byType,
        bySource,
        recentTransactions: transactions as TokenTransactionRecord[]
      }
    } catch (error) {
      console.error('Failed to get transaction stats:', error)
      return {
        totalTransactions: 0,
        totalAcquired: 0,
        totalConsumed: 0,
        byType: {
          FREE: { acquired: 0, consumed: 0 },
          SUBSCRIPTION: { acquired: 0, consumed: 0 },
          PURCHASED: { acquired: 0, consumed: 0 },
          ACTIVITY: { acquired: 0, consumed: 0 },
          BONUS: { acquired: 0, consumed: 0 },
            },
        bySource: {},
        recentTransactions: []
      }
    }
  }

  /**
   * Get token balance history for charting
   */
  static async getBalanceHistory(
    userId: string,
    days: number = 30
  ): Promise<TokenBalanceHistory[]> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)

      // Get all transactions in the time range
      const transactions = await prisma.tokenTransaction.findMany({
        where: {
          userId,
          createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'asc' }
      })

      // Group by date and calculate daily balance
      const dailyData: Record<string, { balance: number; change: number }> = {}

      // Initialize with starting balance (from before the period)
      const firstTransaction = transactions[0]
      if (firstTransaction) {
        dailyData[startDate.toISOString().split('T')[0]] = {
          balance: firstTransaction.balanceBefore,
          change: 0
        }
      }

      // Process each transaction
      transactions.forEach((transaction: { createdAt: Date; balanceBefore: number; balanceAfter: number; amount: number }) => {
        const date = transaction.createdAt.toISOString().split('T')[0]
        
        if (!dailyData[date]) {
          const prevDate = new Date(transaction.createdAt)
          prevDate.setDate(prevDate.getDate() - 1)
          const prevDateStr = prevDate.toISOString().split('T')[0]
          
          dailyData[date] = {
            balance: dailyData[prevDateStr]?.balance || transaction.balanceBefore,
            change: 0
          }
        }

        dailyData[date].balance = transaction.balanceAfter
        dailyData[date].change += transaction.amount
      })

      // Fill missing dates and convert to array
      const history: TokenBalanceHistory[] = []
      const currentDate = new Date(startDate)

      for (let i = 0; i < days; i++) {
        const dateStr = currentDate.toISOString().split('T')[0]
        const dayData = dailyData[dateStr]
        const prevDate = new Date(currentDate)
        prevDate.setDate(prevDate.getDate() - 1)
        const prevDateStr = prevDate.toISOString().split('T')[0]
        const prevData = dailyData[prevDateStr]

        history.push({
          date: dateStr,
          balance: dayData?.balance || prevData?.balance || 0,
          change: dayData?.change || 0
        })

        currentDate.setDate(currentDate.getDate() + 1)
      }

      return history
    } catch (error) {
      console.error('Failed to get balance history:', error)
      return []
    }
  }

  /**
   * Get system-wide token transaction statistics (admin only)
   */
  static async getSystemStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalTransactions: number
    totalTokensInCirculation: number
    totalAcquired: number
    totalConsumed: number
    topUsers: Array<{ userId: string; email: string; netChange: number }>
    byType: Record<TokenType, { acquired: number; consumed: number }>
    dailyTrend: Array<{ date: string; acquired: number; consumed: number }>
  }> {
    try {
      const whereClause: any = {}
      
      if (timeRange) {
        whereClause.createdAt = {
          gte: timeRange.start,
          lte: timeRange.end
        }
      }

      const [
        totalTransactions,
        allTransactions,
        typeStats,
        userStats,
        dailyStats
      ] = await Promise.all([
        // Total transactions
        prisma.tokenTransaction.count({ where: whereClause }),

        // Get all transactions for calculations
        prisma.tokenTransaction.findMany({
          where: whereClause,
          include: {
            user: {
              select: { email: true }
            }
          }
        }),

        // Stats by type
        prisma.tokenTransaction.groupBy({
          by: ['type'],
          where: whereClause,
          _sum: { amount: true }
        }),

        // Top users by net change
        prisma.tokenTransaction.groupBy({
          by: ['userId'],
          where: whereClause,
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 10
        }),

        // Daily trend
        prisma.$queryRaw`
          SELECT 
            DATE(createdAt) as date,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as acquired,
            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as consumed
          FROM token_transactions
          ${timeRange ? prisma.sql`WHERE createdAt >= ${timeRange.start} AND createdAt <= ${timeRange.end}` : prisma.sql``}
          GROUP BY DATE(createdAt)
          ORDER BY date DESC
          LIMIT 30
        ` as Array<{ date: string; acquired: number; consumed: number }>
      ])

      // Calculate totals
      const totalAcquired = allTransactions
        .filter((t: { amount: number }) => t.amount > 0)
        .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)

      const totalConsumed = Math.abs(
        allTransactions
          .filter((t: { amount: number }) => t.amount < 0)
          .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)
      )

      // Get current tokens in circulation
      const latestBalances = await prisma.$queryRaw`
        SELECT DISTINCT ON (user_id) user_id, balance_after
        FROM token_transactions
        ORDER BY user_id, created_at DESC
      ` as Array<{ user_id: string; balance_after: number }>

      const totalTokensInCirculation = latestBalances.reduce(
        (sum, b) => sum + b.balance_after,
        0
      )

      // Initialize type stats
      const byType: Record<TokenType, { acquired: number; consumed: number }> = {
        FREE: { acquired: 0, consumed: 0 },
        SUBSCRIPTION: { acquired: 0, consumed: 0 },
        PURCHASED: { acquired: 0, consumed: 0 },
        ACTIVITY: { acquired: 0, consumed: 0 },
        BONUS: { acquired: 0, consumed: 0 },
        }

      // Fill type stats
      typeStats.forEach((stat: { type: string; _sum: { amount: number | null } }) => {
        const amount = stat._sum.amount || 0
        if (amount > 0) {
          byType[stat.type as TokenType].acquired = amount
        } else {
          byType[stat.type as TokenType].consumed = Math.abs(amount)
        }
      })

      // Get top users with emails
      const userIds = userStats.map((u: { userId: string }) => u.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true }
      })

      const userEmailMap = users.reduce((acc: Record<string, string>, user: { id: string; email: string }) => {
        acc[user.id] = user.email
        return acc
      }, {} as Record<string, string>)

      const topUsers = userStats.map((stat: any) => ({
        userId: stat.userId,
        email: userEmailMap[stat.userId] || 'Unknown',
        netChange: stat._sum.amount || 0
      }))

      return {
        totalTransactions,
        totalTokensInCirculation,
        totalAcquired,
        totalConsumed,
        topUsers,
        byType,
        dailyTrend: dailyStats
      }
    } catch (error) {
      console.error('Failed to get system stats:', error)
      return {
        totalTransactions: 0,
        totalTokensInCirculation: 0,
        totalAcquired: 0,
        totalConsumed: 0,
        topUsers: [],
        byType: {
          FREE: { acquired: 0, consumed: 0 },
          SUBSCRIPTION: { acquired: 0, consumed: 0 },
          PURCHASED: { acquired: 0, consumed: 0 },
          ACTIVITY: { acquired: 0, consumed: 0 },
          BONUS: { acquired: 0, consumed: 0 },
            },
        dailyTrend: []
      }
    }
  }

  /**
   * Export transaction data (admin only)
   */
  static async exportTransactions(filter: TokenTransactionFilter = {}): Promise<{
    data: any[]
    filename: string
    contentType: string
  }> {
    try {
      const whereClause: any = {}

      if (filter.userId) {
        whereClause.userId = filter.userId
      }

      if (filter.type) {
        whereClause.type = Array.isArray(filter.type) 
          ? { in: filter.type } 
          : filter.type
      }

      if (filter.source) {
        whereClause.source = filter.source
      }

      if (filter.startDate || filter.endDate) {
        whereClause.createdAt = {}
        if (filter.startDate) whereClause.createdAt.gte = filter.startDate
        if (filter.endDate) whereClause.createdAt.lte = filter.endDate
      }

      const transactions = await prisma.tokenTransaction.findMany({
        where: whereClause,
        include: {
          user: {
            select: { email: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })

      // Format for export
      const exportData = transactions.map((t: any) => ({
        ID: t.id,
        User: t.user.email,
        UserName: t.user.name,
        Type: t.type,
        Amount: t.amount,
        BalanceBefore: t.balanceBefore,
        BalanceAfter: t.balanceAfter,
        Source: t.source,
        Description: t.description,
        Metadata: JSON.stringify(t.metadata),
        CreatedAt: t.createdAt.toISOString()
      }))

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `token-transactions-${timestamp}.csv`

      return {
        data: exportData,
        filename,
        contentType: 'text/csv'
      }
    } catch (error) {
      console.error('Failed to export transactions:', error)
      return {
        data: [],
        filename: 'error.csv',
        contentType: 'text/csv'
      }
    }
  }
}