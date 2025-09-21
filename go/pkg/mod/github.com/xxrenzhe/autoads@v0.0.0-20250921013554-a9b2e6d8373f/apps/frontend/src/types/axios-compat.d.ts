// Axios 兼容性增强：补充常用字段，避免严格模式报错
import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    proxy?: any
    httpAgent?: any
    httpsAgent?: any
    timeout?: number
    method?: string
    url?: string
    data?: any
    headers?: any
    maxRedirects?: number
    validateStatus?: any
    decompress?: any
    responseType?: any
    transformRequest?: any
    transformResponse?: any
  }
}
