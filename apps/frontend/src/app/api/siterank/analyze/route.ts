import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import axios from 'axios';

const siterankServiceUrl = process.env.SITERANK_SERVICE_URL || 'http://localhost:8084';

export async function POST(req: NextRequest) {
  const token = await getToken({ req });

  if (!token || !token.internalJwt) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    await axios.post(`${siterankServiceUrl}/analyze`, body, {
      headers: {
        Authorization: `Bearer ${token.internalJwt}`,
      },
    });
    return NextResponse.json({ status: 'accepted' }, { status: 202 });
  } catch (error) {
    console.error('Error starting siterank analysis:', error);
    return NextResponse.json({ error: 'Failed to start analysis' }, { status: 500 });
  }
}
