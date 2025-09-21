// Minimal stub for 'ioredis' to allow server build without Redis dependency.
export default class Redis {
  constructor(_config?: any) {}
  async config() { return 'OK' }
  async subscribe(_channel: string) { return 1 }
  async unsubscribe(_channel: string) { return 1 }
  on(_event: string, _handler: (...args: any[]) => void) {}
  off(_event: string, _handler: (...args: any[]) => void) {}
  async publish(_channel: string, _message: string) { return 1 }
  async get(_key: string) { return null }
  async set(_key: string, _val: string, _mode?: string, _duration?: number) { return 'OK' }
}

