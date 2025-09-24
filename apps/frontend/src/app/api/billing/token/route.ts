import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://billing:8080' : 'http://localhost:8082');

export async function GET() {
  const session = await getServerSession(authOptions);
  const firebaseToken = (session as any)?.firebaseToken as string | undefined
  if (!session || !session.user?.id || !firebaseToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const res = await fetch(`${BILLING_SERVICE_URL}/api/v1/billing/tokens/me`, {
      headers: { Authorization: `Bearer ${firebaseToken}` },
      cache: 'no-store'
    });
    const body = await res.text();
    return new Response(body, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
  } catch (e) {
    console.error('Proxy billing token failed:', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
