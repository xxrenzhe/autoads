import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/v5-config";

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://billing:8080' : 'http://localhost:8082');

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id || !session.firebaseToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const res = await fetch(`${BILLING_SERVICE_URL}/api/v1/billing/subscriptions/me`, {
      headers: { Authorization: `Bearer ${session.firebaseToken}` },
      cache: 'no-store'
    });
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
  } catch (e) {
    console.error('Proxy billing subscription failed:', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

