import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import axios from 'axios';

const billingServiceUrl = process.env.BILLING_SERVICE_URL || 'http://localhost:8082';
const offerServiceUrl = process.env.OFFER_SERVICE_URL || 'http://localhost:8083';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });

  if (!token || !token.internalJwt) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const headers = {
      Authorization: `Bearer ${token.internalJwt}`,
    };

    const [tokenResponse, offersResponse] = await Promise.all([
      axios.get(`${billingServiceUrl}/tokens/balance`, { headers }),
      axios.get(`${offerServiceUrl}/offers`, { headers }),
    ]);

    const offerCount = Object.keys(offersResponse.data).length;

    return NextResponse.json({
      tokenBalance: tokenResponse.data.balance,
      offerCount: offerCount,
      activeWorkflows: 0, // Placeholder
    });
  } catch (error) {
    console.error('Error fetching user summary:', error);
    return NextResponse.json({ error: 'Failed to fetch user summary' }, { status: 500 });
  }
}
