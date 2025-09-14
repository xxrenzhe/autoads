/*
  Next.js Route Handler 反向代理到容器内 Go 服务
  - 对外前缀：/go/*
  - 目标后端：BACKEND_URL（默认 http://127.0.0.1:8080）
  - 仅在服务端执行，不经过 Edge Runtime
  - 用法：将原本对 Go 的请求改为同源路径 /go/... 即可
*/

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_BASE = process.env.BACKEND_URL || 'http://127.0.0.1:8080';
const MAX_BODY_BYTES = Number(process.env.BACKEND_PROXY_MAX_BODY || 2 * 1024 * 1024); // 2MB 默认
const UPSTREAM_TIMEOUT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 15000);

function ensureRequestId(headers: Headers): string {
  const existing = headers.get('x-request-id');
  if (existing) return existing;
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  headers.set('x-request-id', id);
  return id;
}

async function readBodyWithLimit(req: Request, limit: number): Promise<BodyInit | undefined> {
  if (['GET', 'HEAD'].includes(req.method)) return undefined;

  const len = req.headers.get('content-length');
  if (len && Number(len) > limit) {
    return new Response(
      JSON.stringify({ message: 'Payload too large', limit }),
      { status: 413, headers: { 'content-type': 'application/json' } }
    ) as unknown as BodyInit;
  }

  // 如果没有 content-length，限速读取
  const reader = req.body?.getReader();
  if (!reader) return undefined;
  let received = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > limit) {
        return new Response(
          JSON.stringify({ message: 'Payload too large', limit }),
          { status: 413, headers: { 'content-type': 'application/json' } }
        ) as unknown as BodyInit;
      }
      chunks.push(value);
    }
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

function getAllowedPrefixes(): string[] {
  const env = process.env.BACKEND_PROXY_ALLOW_PREFIXES;
  if (env && env.trim()) {
    return env.split(',').map(s => s.trim()).filter(Boolean);
  }
  // 默认仅允许健康检查与常用后端前缀，避免误转发
  return ['/health', '/ready', '/live', '/api/', '/admin/'];
}

async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url);
  const subPath = `/${path.join('/')}`;
  // 前缀白名单校验
  const allowed = getAllowedPrefixes();
  const isAllowed = allowed.some(prefix => subPath === prefix || subPath.startsWith(prefix));
  if (!isAllowed) {
    return new Response(JSON.stringify({ message: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  }
  const target = `${BACKEND_BASE}${subPath}${url.search}`;

  // 复制并清理请求头，移除 Hop-by-hop/受限头
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('accept-encoding');
  // 透传/注入链路与来源信息
  const requestId = ensureRequestId(headers);
  const originalHost = new URL(req.url).host;
  headers.set('x-forwarded-host', originalHost);
  const fwdFor = req.headers.get('x-forwarded-for');
  if (fwdFor) headers.set('x-forwarded-for', fwdFor);

  // 处理请求体（非 GET/HEAD）
  let body: BodyInit | undefined = undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    const maybe = await readBodyWithLimit(req, MAX_BODY_BYTES);
    // readBodyWithLimit 会在超过限制时返回 Response 对象（类型欺骗），此处识别并直接返回
    if (maybe instanceof Response) return maybe;
    body = maybe;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const t0 = Date.now();
    const resp = await fetch(target, {
      method: req.method,
      headers,
      body,
      // 同步 cookies/鉴权头同域透传
      redirect: 'manual',
      signal: controller.signal,
    });
    const upstreamMs = Date.now() - t0;
    clearTimeout(timeout);

    // 透传响应体与头部
    const respHeaders = new Headers(resp.headers);
    respHeaders.set('x-request-id', requestId);
    const existingTiming = respHeaders.get('server-timing');
    const timing = `upstream;dur=${upstreamMs}`;
    respHeaders.set('server-timing', existingTiming ? `${existingTiming}, ${timing}` : timing);
    return new Response(resp.body, { status: resp.status, headers: respHeaders });
  } catch (err) {
    const message = (err as Error).message || '';
    const isTimeout = message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout');
    const status = isTimeout ? 504 : 502;
    return new Response(
      JSON.stringify({ message: isTimeout ? 'Upstream timeout' : 'Upstream unavailable', error: message }),
      { status, headers: { 'content-type': 'application/json' } }
    );
  }
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function HEAD(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PUT(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PATCH(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function DELETE(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function OPTIONS(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
