import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const ADSCENTER_SERVICE_URL = process.env.ADSCENTER_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://adscenter:8080' : 'http://localhost:8086');

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const firebaseToken = (session as any)?.firebaseToken as string | undefined
  if (!session || !session.user?.id || !firebaseToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${ADSCENTER_SERVICE_URL}/api/v1/adscenter/keywords/expand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${firebaseToken}` },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const payload = await res.json().catch(() => ({}));
    return new Response(JSON.stringify(payload), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy_failed' }), { status: 502 });
  }
}

