// Minimal stub for 'puppeteer'
export async function launch(_opts?: any) {
  return {
    newPage: async () => ({
      goto: async (_url: string) => {},
      setUserAgent: async (_ua: string) => {},
      close: async () => {},
    }),
    close: async () => {},
  }
}
export default { launch }

