import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const CONSOLE_SERVICE_URL = process.env.CONSOLE_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://console:8080' : 'http://localhost:8080');

export async function GET(_: Request, ctx: { params: { id: string }}) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.firebaseToken as string | undefined
  if (!session || !session.user?.id || !token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const id = ctx.params.id;
  const upstream = `${CONSOLE_SERVICE_URL}/api/v1/console/users/${id}/tokens`;
  const res = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const payload = await res.json().catch(()=>({}));
  return new Response(JSON.stringify(payload), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: Request, ctx: { params: { id: string }}) {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.firebaseToken as string | undefined
  if (!session || !session.user?.id || !token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const id = ctx.params.id;
  const body = await req.text();
  const upstream = `${CONSOLE_SERVICE_URL}/api/v1/console/users/${id}/tokens`;
  const res = await fetch(upstream, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body });
  const payload = await res.json().catch(()=>({}));
  return new Response(JSON.stringify(payload), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
