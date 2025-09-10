import { NextRequest, NextResponse } from 'next/server';
import { isHostTrusted, createTrustHostConfig } from '@/lib/auth/trust-host';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const host = request.headers.get('host') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const origin = request.headers.get('origin') || 'unknown';
  const referer = request.headers.get('referer') || 'unknown';
  
  // 获取信任主机配置
  const trustHostConfig = createTrustHostConfig();
  const isTrusted = isHostTrusted(host);

  const debugInfo = {
    timestamp: new Date().toISOString(),
    request: {
      host,
      origin,
      referer,
      userAgent,
      url: request.url,
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
      AUTH_URL: process.env.AUTH_URL,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
      AUTH_TRUSTED_HOSTS: process.env.AUTH_TRUSTED_HOSTS,
      HOSTNAME: process.env.HOSTNAME,
      DOCKER_ENV: process.env.DOCKER_ENV,
    },
    trust: {
      isTrusted,
      trustHostConfig: typeof trustHostConfig,
    },
    patterns: {
      clawCloudPreview: /^autoads-preview-[a-f0-9]+-[a-z0-9]+:3000$/.test(host),
      clawCloudProd: /^autoads-prod-[a-f0-9]+-[a-z0-9]+:3000$/.test(host),
    }
  };

  return NextResponse.json(debugInfo, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}