// Cron 兼容声明
declare module 'cron' {
  export type Cron = any
  const CronCtor: any
  export default CronCtor
}

