import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const BATCHOPEN_SERVICE_URL = process.env.BATCHOPEN_SERVICE_URL
  || (process.env.DOCKERIZED ? 'http://batchopen:8080' : 'http://localhost:8085');

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.firebaseToken as string | undefined
  if (!session || !session.user?.id || !token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const upstream = `${BATCHOPEN_SERVICE_URL}/api/v1/batchopen/stats`;
  try {
    const res = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` }, cache:'no-store' });
    const body = await res.json().catch(()=>({}));
    return new Response(JSON.stringify(body), { status: res.status, headers: { 'Content-Type':'application/json' } });
  } catch {
    return new Response(JSON.stringify({}), { status: 200 });
  }
}

