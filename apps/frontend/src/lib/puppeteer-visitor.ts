/**
 * Puppeteer Visitor Stub（前端兼容层）
 * 执行器已迁移到 Go 后端；前端不再运行浏览器自动化。
 * 仅保留方法签名，便于旧代码在编译期通过并提示改用后端 API。
 */

import { ProxyConfig } from '@/lib/utils/proxy-utils'

export interface PuppeteerVisitOptions {
  url: string
  proxy?: ProxyConfig
  userAgent?: string
  timeout?: number
  referer?: string
  stealthMode?: boolean
  headers?: Record<string, string>
}

export interface PuppeteerVisitResult {
  success: boolean
  error?: string
  loadTime?: number
  finalUrl?: string
  content?: string
  title?: string
  proxyUsed: boolean
}

export class PuppeteerVisitor {
  async visit(_options: PuppeteerVisitOptions): Promise<PuppeteerVisitResult> {
    return {
      success: false,
      error: 'Puppeteer 已迁移至后端，请通过 BFF 调用后端 API 执行。',
      proxyUsed: false
    }
  }

  async visitUrl(options: PuppeteerVisitOptions): Promise<PuppeteerVisitResult> {
    return this.visit(options)
  }
}

export const puppeteerVisitor = new PuppeteerVisitor()

