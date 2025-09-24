// Minimal stub for 'google-ads-api' to avoid bundling heavy SDK in SSR functions.
export class GoogleAdsApi {
  constructor(_opts?: any) {}
  customer(_cid: string, _loginCustomerId?: string) {
    throw new Error("google-ads-api is not available in this SSR runtime. Use backend service instead.")
  }
}
export const enums: any = {}
export const services: any = {}
export const resources: any = {}
export type Customer = any

