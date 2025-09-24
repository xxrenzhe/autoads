import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { offerId: string } }
) {
  const token = await getToken({ req });
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { offerId } = params;

  try {
    const analysis = await prisma.siterankAnalysis.findUnique({
      where: { offerId },
    });

    if (!analysis) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error(`Error fetching analysis for offer ${offerId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}
