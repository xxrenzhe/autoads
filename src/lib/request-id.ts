import { randomUUID } from 'crypto';

// 生成请求ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

// 从请求头中获取或生成请求ID
export function getOrCreateRequestId(headers: Headers): string {
  const requestId = headers.get('x-request-id') || generateRequestId();
  return requestId;
}

// 为NextRequest添加请求ID
export function withRequestId(request: Request): Request {
  const headers = new Headers(request.headers);
  const requestId = getOrCreateRequestId(headers);
  headers.set('x-request-id', requestId);
  
  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
    signal: request.signal
  });
}