import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  // 声明式列出重要“插件/构件”，便于健康检查与排障
  const plugins = [
    { key: 'x-request-id', status: 'enabled', via: 'middleware + BFF' },
    { key: 'rate-limit-headers', status: 'passthrough', via: 'BFF' },
    { key: 'readiness-gate', status: 'enabled', via: 'BFF /readyz preflight' },
    { key: 'prisma-guard', status: (process.env.NEXT_PRISMA_GUARD ?? 'true'), scope: 'auth-only writes' },
  ]
  return NextResponse.json({ plugins })
}

