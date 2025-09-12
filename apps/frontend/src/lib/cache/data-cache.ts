import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'

// Cache plans data for 1 hour
export const getCachedPlans = unstable_cache(
  async () => {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    })
  },
  ['plans'],
  { revalidate: 3600, tags: ['plans'] }
)

// Cache user subscription data for 5 minutes
export const getCachedUserSubscription = unstable_cache(
  async (userId: string) => {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: new Date()
        }
      },
      include: {
        plan: true
      }
    })
  },
  ['user-subscription'],
  { revalidate: 300, tags: ['subscription'] }
)

// Cache user data for 10 minutes
export const getCachedUser = unstable_cache(
  async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    })
  },
  ['user'],
  { revalidate: 600, tags: ['user'] }
)

// Cache usage statistics for 1 hour
export const getCachedUserUsage = unstable_cache(
  async (userId: string, period: 'day' | 'week' | 'month' = 'month') => {
    const startDate = new Date()
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1)
        break
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1)
        break
    }

    return prisma.usageLog.groupBy({
      by: ['feature'],
      where: {
        userId,
        date: {
          gte: startDate
        }
      },
      _sum: {
        usage: true
      },
      _count: {
        usage: true
      }
    })
  },
  ['user-usage'],
  { revalidate: 3600, tags: ['usage'] }
)