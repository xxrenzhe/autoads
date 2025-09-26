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
    const res = await fetch(`${BILLING_SERVICE_URL}/api/v1/billing/tokens/transactions`, {
      headers: { Authorization: `Bearer ${firebaseToken}` },
      cache: 'no-store'
    });
    const raw = await res.json().catch(() => ([]));
    const records = Array.isArray(raw) ? raw.map((t: any) => ({
      id: t.id,
      amount: t.amount,
      action: t.type,
      timestamp: t.createdAt,
      description: t.description
    })) : [];
    const body = { records, pagination: { page: 1, limit: records.length, total: records.length, totalPages: 1, hasMore: false } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Proxy /api/tokens/transactions failed:', e);
    return new Response(JSON.stringify({ records: [], pagination: { page: 1, limit: 0, total: 0, totalPages: 0, hasMore: false } }), { status: 200 });
  }
}

