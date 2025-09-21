import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8080'
  const bff = {
    enabled: true,
    entry: '/api/go/*',
    backend,
  }
  const ops = {
    proxy: '/ops/*',
    allowPrefixes: (process.env.ADMIN_PROXY_ALLOW_PREFIXES || '/console,/api/v1/console').split(',')
  }
  const auth = {
    strategy: 'next-auth (jwt)',
    domain: 'users/accounts/sessions/verification_tokens/user_devices'
  }
  return NextResponse.json({
    app: 'AutoAds',
    version: process.env.npm_package_version || 'unknown',
    mode: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
    bff,
    ops,
    auth,
  })
}

