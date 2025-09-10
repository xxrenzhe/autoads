import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';

// GET /api/admin/payment-providers - 获取支付提供商配置
export async function GET() {
  return NextResponse.json(
    { error: 'Payment providers feature is not yet implemented' },
    { status: 503 }
  );
}

// POST /api/admin/payment-providers - 创建或更新支付提供商配置
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Payment providers feature is not yet implemented' },
    { status: 503 }
  );
}