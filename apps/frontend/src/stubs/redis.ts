// Minimal stub for 'redis'
export const createClient = (_opts?: any) => ({
  on: (_: string, __: any) => {},
  connect: async () => {},
  disconnect: async () => {},
  publish: async (_ch: string, _msg: string) => 1,
  subscribe: async (_ch: string) => 1,
  unsubscribe: async (_ch: string) => 1,
})
export default { createClient }

