// Redis stub for development
const cacheStore = new Map()

export const redisClient = {
  get: async (key: string) => {
    return cacheStore.get(key)
  },
  set: async (key: string, value: any, options?: any) => {
    cacheStore.set(key, value)
    if (options?.EX) {
      setTimeout(() => cacheStore.delete(key), options.EX * 1000)
    }
    return 'OK'
  },
  del: async (key: string) => {
    return cacheStore.delete(key) ? 1 : 0
  },
  exists: async (key: string) => {
    return cacheStore.has(key) ? 1 : 0
  },
  incr: async (key: string) => {
    const current = parseInt(cacheStore.get(key) || '0')
    const newValue = current + 1
    cacheStore.set(key, newValue.toString())
    return newValue
  },
  incrby: async (key: string, increment: number) => {
    const current = parseInt(cacheStore.get(key) || '0')
    const newValue = current + increment
    cacheStore.set(key, newValue.toString())
    return newValue
  },
  decr: async (key: string) => {
    const current = parseInt(cacheStore.get(key) || '0')
    const newValue = current - 1
    cacheStore.set(key, newValue.toString())
    return newValue
  },
  decrby: async (key: string, decrement: number) => {
    const current = parseInt(cacheStore.get(key) || '0')
    const newValue = current - decrement
    cacheStore.set(key, newValue.toString())
    return newValue
  },
  expire: async (key: string, seconds: number) => {
    if (cacheStore.has(key)) {
      setTimeout(() => cacheStore.delete(key), seconds * 1000)
      return 1
    }
    return 0
  },
  hget: async (key: string, field: string) => {
    const hash = cacheStore.get(key)
    return hash?.[field]
  },
  hset: async (key: string, field: string, value: any) => {
    let hash = cacheStore.get(key) || {}
    hash[field] = value
    cacheStore.set(key, hash)
    return 1
  },
  hdel: async (key: string, field: string) => {
    const hash = cacheStore.get(key)
    if (hash && hash[field]) {
      delete hash[field]
      return 1
    }
    return 0
  },
  keys: async (pattern: string) => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return Array.from(cacheStore.keys()).filter(key => regex.test(key))
  },
  flushall: async () => {
    cacheStore.clear()
    return 'OK'
  },
  connect: async () => {
    console.log('Redis stub connected')
  },
  on: (event: string, callback: Function) => {
    // Stub for event handling
  },
  ttl: async (key: string) => {
    // In memory stub, return -1 if key doesn't exist or -2 if no expiry
    return cacheStore.has(key) ? -1 : -2
  },
  setex: async (key: string, seconds: number, value: any) => {
    cacheStore.set(key, value);
    setTimeout(() => cacheStore.delete(key), seconds * 1000);
    return 'OK';
  },
  ping: async () => {
    return 'PONG';
  },
  info: async () => {
    return 'Redis stub info';
  },
  lpush: async (key: string, ...values: any[]) => {
    const list = cacheStore.get(key) || [];
    list.unshift(...values);
    cacheStore.set(key, list);
    return list.length;
  },
  ltrim: async (key: string, start: number, stop: number) => {
    const list = cacheStore.get(key) || [];
    const trimmed = list.slice(start, stop + 1);
    cacheStore.set(key, trimmed);
    return 'OK';
  },
  quit: async () => {
    console.log('Redis stub disconnected')
  }
}

export default redisClient
