import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth/auth-config" // Assuming auth config is here
import { NextResponse } from "next/server"

// This is a placeholder for your actual service discovery logic
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:8081';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.firebaseToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(`${BILLING_SERVICE_URL}/api/v1/billing/subscriptions/me`, {
      headers: {
        'Authorization': `Bearer ${session.firebaseToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching subscription from billing service:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
