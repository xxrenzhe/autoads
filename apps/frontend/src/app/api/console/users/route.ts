import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const CONSOLE_SERVICE_URL = process.env.CONSOLE_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://console:8080' : 'http://localhost:8080');

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const firebaseToken = (session as any)?.firebaseToken as string | undefined
  if (!session || !session.user?.id || !firebaseToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const url = new URL(req.url);
  const qs = url.search ? url.search : '';
  const upstream = `${CONSOLE_SERVICE_URL}/api/v1/console/users${qs}`;
  try {
    const res = await fetch(upstream, { headers: { Authorization: `Bearer ${firebaseToken}` }, cache: 'no-store' });
    const body = await res.json().catch(()=>({items:[]}));
    return new Response(JSON.stringify(body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  }
}

