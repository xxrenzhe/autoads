import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import axios from 'axios';

const billingServiceUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:8082';

export async function POST(req: NextRequest) {
  const token = await getToken({ req });

  if (!token || !token.internalJwt) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const response = await axios.post(`${billingServiceUrl}/payments/create-checkout-session`, body, {
      headers: {
        Authorization: `Bearer ${token.internalJwt}`,
      },
    });
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
