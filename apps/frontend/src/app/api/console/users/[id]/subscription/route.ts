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
  const upstream = `${CONSOLE_SERVICE_URL}/api/v1/console/users/${id}/subscription`;
  const res = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const body = await res.json().catch(()=>({}));
  return new Response(JSON.stringify(body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

