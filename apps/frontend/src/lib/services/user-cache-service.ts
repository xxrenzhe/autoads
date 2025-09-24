import { prisma } from '@/lib/db';

/**
 * User cache service for optimized user management queries
 */
export class UserCacheService {
  private static instance: UserCacheService;
  private cache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();
  
  // Cache TTL in milliseconds
  private readonly CACHE_TTL = {
    userList: 2 * 60 * 1000,      // 2 minutes
    userDetail: 5 * 60 * 1000,    // 5 minutes
    userStats: 10 * 60 * 1000,    // 10 minutes
    rolePermissions: 60 * 60 * 1000 // 1 hour
  };

  static getInstance(): UserCacheService {
    if (!UserCacheService.instance) {
      UserCacheService.instance = new UserCacheService();
    }
    return UserCacheService.instance;
  }

  /**
   * Get cached data or fetch from database
   */
  async getCachedData<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl: number = this.CACHE_TTL.userList
  ): Promise<T> {
    const now = Date.now();
    const expiry = this.cacheExpiry.get(key);
    
    // Return cached data if still valid
    if (expiry && now < expiry && this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Fetch fresh data
    const data = await fetcher();
    
    // Cache the data
    this.cache.set(key, data);
    this.cacheExpiry.set(key, now + ttl);
    
    return data;
  }

  /**
   * Get optimized user list with caching
   */
  async getUserList(filters: any, includeDetails: boolean = false) {
    const cacheKey = `userList:${JSON.stringify(filters)}:${includeDetails}`;
    
    return this.getCachedData(
      cacheKey,
      async () => {
        const { page = 1, limit = 25, sortBy = 'createdAt', sortOrder = 'DESC', ...where } = filters;
        const skip = (page - 1) * limit;

        // Base select fields
        const baseSelect = {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          tokenBalance: true,
          createdAt: true,
          lastLoginAt: true,
        };

        // Extended select fields
        const extendedSelect = includeDetails ? {
          ...baseSelect,
          tokenUsedThisMonth: true,
          avatar: true,
          emailVerified: true,
          subscriptions: {
            select: {
              id: true,
              status: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              plan: { select: { id: true, name: true } }
            },
            where: { status: 'ACTIVE' as any },
            orderBy: { currentPeriodEnd: 'desc' as const },
            take: 1
          },
          _count: {
            select: {
              subscriptions: true,
              payments: true,
              tokenTransactions: true,
            }
          }
        } : baseSelect;

        const [users, total] = await Promise.all([
          prisma.user.findMany({
            where: this.buildWhereClause(where),
            select: extendedSelect,
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit,
          }),
          prisma.user.count({ where: this.buildWhereClause(where) })
        ]);

        return {
          items: users,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      },
      this.CACHE_TTL.userList
    );
  }

  /**
   * Get user details with caching
   */
  async getUserDetails(userId: string) {
    const cacheKey = `userDetail:${userId}`;
    
    return this.getCachedData(
      cacheKey,
      async () => {
        return prisma.user.findUnique({
          where: { id: userId },
          include: {
            subscriptions: {
              include: { plan: true },
              orderBy: { createdAt: 'desc' }
            },
            tokenTransactions: {
              orderBy: { createdAt: 'desc' },
              take: 10
            },
            _count: {
              select: {
                subscriptions: true,
                payments: true,
                tokenTransactions: true,
              }
            }
          }
        });
      },
      this.CACHE_TTL.userDetail
    );
  }

  /**
   * Build where clause for user queries
   */
  private buildWhereClause(filters: any) {
    const where: any = {};
    
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    
    if (filters.hasSubscription !== undefined) {
      if (filters.hasSubscription === 'true') {
        where.subscriptions = { some: { status: 'ACTIVE' } };
      } else {
        where.subscriptions = { none: { status: 'ACTIVE' } };
      }
    }
    
    return where;
  }

  /**
   * Invalidate cache for specific keys or patterns
   */
  invalidateCache(pattern?: string) {
    if (!pattern) {
      // Clear all cache
      this.cache.clear();
      this.cacheExpiry.clear();
      return;
    }
    
    // Clear cache entries matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Invalidate user-specific cache
   */
  invalidateUserCache(userId: string) {
    this.invalidateCache(`userDetail:${userId}`);
    this.invalidateCache('userList:'); // Invalidate all user lists
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now >= expiry) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }
}

// Export singleton instance
export const userCacheService = UserCacheService.getInstance();
