// Minimal compatibility declarations for google-ads-api to avoid type errors
declare module 'google-ads-api' {
  export const resources: any
  export const services: any
  export const enums: any
  export const Customer: any
  export class GoogleAdsApi {
    constructor(config: any)
    Customer(opts: any): any
  }
  export type Customer = any
  export type GoogleAdsApi = any
}
