// redis / ioredis 兼容声明

declare module 'redis' {
  export type RedisClientType = any
  export function createClient(options?: any): any
}

declare module 'ioredis' {
  export type Redis = any
  const RedisCtor: any
  export default RedisCtor
}

