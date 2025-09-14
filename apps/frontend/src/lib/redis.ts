import { getOptimizedRedisClient } from '@/lib/cache/optimized-redis-client'

// 统一导出一个与 ioredis 接口相近的客户端；
// 在没有 REDIS_URL 时自动回退到内存实现（见 optimized-redis-client）
const client = getOptimizedRedisClient().getClient()

export const redisClient = client
export default client
