// Minimal compatibility types for puppeteer to satisfy TS
declare module 'puppeteer' {
  export interface Browser {
    [key: string]: any
  }
  export interface Page {
    [key: string]: any
  }
  export interface LaunchOptions {
    [key: string]: any
  }
  export function connect(options: any): Promise<Browser>
}

