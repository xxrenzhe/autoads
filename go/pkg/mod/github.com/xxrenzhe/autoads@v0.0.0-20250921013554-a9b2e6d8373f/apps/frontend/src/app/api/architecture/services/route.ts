import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // 列出前端暴露/代理的核心服务
  const services = [
    { name: 'BatchOpen BFF', path: '/api/batchopen/*', upstream: '/api/v1/batchopen/*' },
    { name: 'SiteRank BFF', path: '/api/siterank/*', upstream: '/api/v1/siterank/*' },
    { name: 'AdsCenter BFF', path: '/api/adscenter/*', upstream: '/api/v1/adscenter/*' },
    { name: 'Unified BFF', path: '/api/go/*', upstream: process.env.BACKEND_URL || 'http://127.0.0.1:8080' },
    { name: 'Ops Console', path: '/ops/*', upstream: process.env.BACKEND_URL || 'http://127.0.0.1:8080' },
  ]
  return NextResponse.json({ services })
}

