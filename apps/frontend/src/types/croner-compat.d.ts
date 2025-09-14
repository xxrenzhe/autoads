// croner 兼容声明
declare module 'croner' {
  export function Cron(...args: any[]): any
  export class Cron {
    constructor(...args: any[])
    stop(): void
    nextRun?: () => Date | null
  }
  export default Cron
}
