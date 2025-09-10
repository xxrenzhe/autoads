import { NextRequest, NextResponse } from 'next/server';

// POST /api/payments/stripe/webhook - Stripe webhook 处理
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Payment processing feature is not yet implemented' },
    { status: 503 }
  );
}