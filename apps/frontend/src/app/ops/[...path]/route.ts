/*
  Next.js Route Handler 反向代理到容器内 Go 管理端
  - 对外前缀：/ops/*
  - 目标后端：/console/* 与 /api/v1/console/*
  - 不依赖 NextAuth 做管理员预检，权限由 Go 的 AdminJWT 严格校验
  - 为所有响应添加 X-Robots-Tag 禁止收录
*/

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_BASE = process.env.BACKEND_URL || 'http://127.0.0.1:8080';
const MAX_BODY_BYTES = Number(process.env.BACKEND_PROXY_MAX_BODY || 2 * 1024 * 1024);
const UPSTREAM_TIMEOUT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 15000);

function getAllowedPrefixes(): string[] {
  const env = process.env.ADMIN_PROXY_ALLOW_PREFIXES;
  if (env && env.trim()) {
    return env.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [
    '/console/',
    '/console/panel',
    '/console/login',
    '/api/v1/console/'
  ];
}

async function readBodyWithLimit(req: Request, limit: number): Promise<BodyInit | undefined | Response> {
  if (['GET', 'HEAD'].includes(req.method)) return undefined;
  const len = req.headers.get('content-length');
  if (len && Number(len) > limit) {
    return new Response(JSON.stringify({ message: 'Payload too large', limit }), { status: 413, headers: { 'content-type': 'application/json' } });
  }
  const reader = req.body?.getReader();
  if (!reader) return undefined;
  let received = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > limit) {
        return new Response(JSON.stringify({ message: 'Payload too large', limit }), { status: 413, headers: { 'content-type': 'application/json' } });
      }
      chunks.push(value);
    }
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url);
  const subPath = `/${path.join('/')}`;
  const allowed = getAllowedPrefixes();
  const isAllowed = allowed.some(prefix => subPath === prefix || subPath.startsWith(prefix));
  if (!isAllowed) {
    return new Response(JSON.stringify({ message: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  const target = `${BACKEND_BASE}${subPath}${url.search}`;

  // 透传请求头（不修改 Authorization，交由后端校验）
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('accept-encoding');
  if (!headers.get('x-request-id')) {
    headers.set('x-request-id', `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`);
  }

  let body: BodyInit | undefined | Response = undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await readBodyWithLimit(req, MAX_BODY_BYTES);
    if (body instanceof Response) return body;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const resp = await fetch(target, { method: req.method, headers, body, redirect: 'manual', signal: controller.signal });
    clearTimeout(timeout);
    const respHeaders = new Headers(resp.headers);
    respHeaders.set('X-Robots-Tag', 'noindex, nofollow');
    // 贯通请求 ID
    const reqId = headers.get('x-request-id') || '';
    if (reqId) respHeaders.set('x-request-id', reqId);
    return new Response(resp.body, { status: resp.status, headers: respHeaders });
  } catch (err) {
    const message = (err as Error).message || '';
    const isTimeout = message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout');
    const status = isTimeout ? 504 : 502;
    return new Response(JSON.stringify({ message: isTimeout ? 'Upstream timeout' : 'Upstream unavailable', error: message }), { status, headers: { 'content-type': 'application/json', 'X-Robots-Tag': 'noindex, nofollow' } });
  }
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function HEAD(req: Request, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function POST(req: Request, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function PUT(req: Request, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function PATCH(req: Request, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function DELETE(req: Request, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export async function OPTIONS(req: Request, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }

