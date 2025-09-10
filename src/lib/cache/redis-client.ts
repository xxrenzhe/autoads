import { getOptimizedRedisClient } from './optimized-redis-client';

// 兼容性包装器，使用新的优化Redis客户端
function getRedisClient() {
  const optimizedClient = getOptimizedRedisClient();
  return optimizedClient.getClient();
}

// 获取Redis配置信息
const redisConfig = {
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB
};

export { getRedisClient, redisConfig };