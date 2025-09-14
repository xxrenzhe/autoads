// Minimal stub for 'croner'
export class Cron {
  private fn: () => any
  constructor(_expr: string, _opts: any, fn: () => any) {
    this.fn = fn
  }
  stop() {}
}
export default { Cron }

