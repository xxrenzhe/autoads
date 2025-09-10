import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/db';
import { StripeService } from '@/lib/services/stripe';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// POST /api/payments/stripe/create-intent - 创建 Stripe 支付意图
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Payment processing feature is not yet implemented' },
    { status: 503 }
  );
}