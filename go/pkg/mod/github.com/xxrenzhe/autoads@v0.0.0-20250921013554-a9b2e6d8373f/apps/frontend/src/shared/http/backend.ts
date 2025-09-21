import { robustFetch } from '@/lib/utils/api/robust-client';

export interface HttpError extends Error {
  status?: number;
  details?: any;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  timeoutMs?: number;
  cacheTtlMs?: number;
  unwrapData?: boolean;
}

function getBaseUrl(): string {
  // Default to Next.js Route Handler proxy prefix
  return process.env.NEXT_PUBLIC_BACKEND_PREFIX || '/go';
}

function buildUrl(endpoint: string, params?: Record<string, any>): string {
  const base = getBaseUrl();
  const isAbsolute = /^https?:\/\//i.test(endpoint);
  const basePrefixed = isAbsolute ? endpoint : `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  if (!params || Object.keys(params).length === 0) return basePrefixed;

  const url = new URL(basePrefixed, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    url.searchParams.append(k, String(v));
  });
  return isAbsolute ? url.toString() : url.pathname + (url.search ? `${url.search}` : '');
}

type CacheEntry = { expiresAt: number; data: any };
const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();
const etagStore = new Map<string, string>();

function cacheKeyFrom(method: HttpMethod, url: string) {
  return `${method} ${url}`;
}

async function parseJsonSafe(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function unwrapIfNeeded<T>(data: any, unwrap?: boolean): T {
  if (!unwrap) return data as T;
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data.data as T);
  }
  return data as T;
}

async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, params, cacheTtlMs, unwrapData } = options;
  const url = buildUrl(endpoint, method === 'GET' ? params : undefined);

  const reqHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...headers
  };

  // 注入请求ID以便端到端追踪
  if (!reqHeaders['x-request-id']) {
    reqHeaders['x-request-id'] = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  const init: RequestInit = {
    method,
    headers: reqHeaders,
    credentials: 'include',
  };

  if (method !== 'GET' && body !== undefined) {
    if (body instanceof FormData) {
      delete (reqHeaders as any)['Content-Type'];
      init.body = body;
    } else {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  const key = cacheKeyFrom(method, url);

  if (method === 'GET' && cacheTtlMs && cacheTtlMs > 0) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return unwrapIfNeeded<T>(cached.data, unwrapData);
    }
  }

  if (inflight.has(key)) {
    return inflight.get(key)! as Promise<T>;
  }

  const exec = (async () => {
    // Conditional GET with ETag
    if (method === 'GET') {
      const etag = etagStore.get(url);
      if (etag) {
        reqHeaders['If-None-Match'] = etag;
      }
    }
    const t0 = Date.now();
    const response = await robustFetch(url, init);
    if (response.ok) {
      const data = await parseJsonSafe(response);
      const result = (data ?? undefined) as any;
      const t1 = Date.now();
      const reqId = response.headers.get('x-request-id') || reqHeaders['x-request-id'];
      const serverTiming = response.headers.get('server-timing') || '';
      // 基础观测：仅轻量输出；如需更强观测可接入埋点
      if (typeof window !== 'undefined' && (process.env.NODE_ENV !== 'production')) {
        console.debug('[backend]', response.status, method, url, `${t1 - t0}ms`, reqId, serverTiming);
      }
      // Persist ETag for future conditional GETs
      if (method === 'GET') {
        const etag = response.headers.get('etag');
        if (etag) etagStore.set(url, etag);
      }
      if (method === 'GET' && cacheTtlMs && cacheTtlMs > 0) {
        responseCache.set(key, { expiresAt: Date.now() + cacheTtlMs, data: result });
      }
      return unwrapIfNeeded<T>(result, unwrapData);
    }
    // 304 Not Modified: serve cached content if available
    if (method === 'GET' && response.status === 304) {
      const cached = responseCache.get(key);
      if (cached) {
        return unwrapIfNeeded<T>(cached.data, unwrapData);
      }
    }
    const error: HttpError = new Error(`${response.status} ${response.statusText}`);
    error.status = response.status;
    error.details = await parseJsonSafe(response);
    throw error;
  })();

  inflight.set(key, exec);
  try {
    return (await exec) as T;
  } finally {
    inflight.delete(key);
  }
}

export const backend = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) => request<T>(endpoint, { method: 'GET', params }),
  post: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body }),
  put: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PUT', body }),
  patch: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  getCached: <T = any>(endpoint: string, params?: Record<string, any>, cacheTtlMs: number = 10_000, unwrapData: boolean = true) =>
    request<T>(endpoint, { method: 'GET', params, cacheTtlMs, unwrapData })
};

export default backend;
