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
  // Pass-through options for robustFetch
  timeoutMs?: number;
  // Optional lightweight cache for GETs (ms)
  cacheTtlMs?: number;
  // If true, unwrap common { success, data } response shape
  unwrapData?: boolean;
}

function getBaseUrl(): string {
  // Prefer explicit public API base when available
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv;
  // Default to Next.js API
  return '/api';
}

function buildUrl(endpoint: string, params?: Record<string, any>): string {
  const base = getBaseUrl();
  // If endpoint already includes protocol, use as-is
  const isAbsolute = /^https?:\/\//i.test(endpoint);
  const basePrefixed = isAbsolute ? endpoint : `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  if (!params || Object.keys(params).length === 0) return basePrefixed;
  
  const url = new URL(basePrefixed, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    url.searchParams.append(k, String(v));
  });
  // Keep absolute URLs intact; return relative path for same-origin API
  return isAbsolute ? url.toString() : url.pathname + (url.search ? `${url.search}` : '');
}

// Simple in-memory cache and in-flight request de-duplication
type CacheEntry = { expiresAt: number; data: any };
const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();

function cacheKeyFrom(method: HttpMethod, url: string, body?: any) {
  // Only cache GETs by URL; include method for safety
  if (method !== 'GET') return `${method} ${url}`;
  return `${method} ${url}`;
}

function unwrapIfNeeded<T>(data: any, unwrap?: boolean): T {
  if (!unwrap) return data as T;
  if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
    return (data.data as T);
  }
  return data as T;
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

async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, params, cacheTtlMs, unwrapData } = options;
  const url = buildUrl(endpoint, method === 'GET' ? params : undefined);

  const reqHeaders: Record<string, string> = {
    'Accept': 'application/json',
    ...headers
  };

  const init: RequestInit = {
    method,
    headers: reqHeaders,
    credentials: 'include',
  };

  if (method !== 'GET' && body !== undefined) {
    if (body instanceof FormData) {
      // Let the browser set the boundary
      delete (reqHeaders as any)['Content-Type'];
      init.body = body;
    } else {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
  }

  const key = cacheKeyFrom(method, url, body);

  // Serve from cache for GETs when valid
  if (method === 'GET' && cacheTtlMs && cacheTtlMs > 0) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return unwrapIfNeeded<T>(cached.data, unwrapData);
    }
  }

  // De-duplicate in-flight requests
  if (inflight.has(key)) {
    return inflight.get(key)! as Promise<T>;
  }

  const exec = (async () => {
    const response = await robustFetch(url, init);
    if (response.ok) {
      const data = await parseJsonSafe(response);
      const result = (data ?? undefined) as any;

      // Populate cache for GETs
      if (method === 'GET' && cacheTtlMs && cacheTtlMs > 0) {
        responseCache.set(key, { expiresAt: Date.now() + cacheTtlMs, data: result });
      }

      return unwrapIfNeeded<T>(result, unwrapData);
    }

    const error: HttpError = new Error(`${response.status} ${response.statusText}`);
    error.status = response.status;
    error.details = await parseJsonSafe(response);
    throw error;
  })();

  inflight.set(key, exec);
  try {
    const out = await exec;
    return out as T;
  } finally {
    inflight.delete(key);
  }
}

export const http = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) => request<T>(endpoint, { method: 'GET', params }),
  post: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'POST', body }),
  put: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PUT', body }),
  patch: <T = any>(endpoint: string, body?: any) => request<T>(endpoint, { method: 'PATCH', body }),
  delete: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  // Cached GET with optional unwrapping { success, data }
  getCached: <T = any>(endpoint: string, params?: Record<string, any>, cacheTtlMs: number = 10_000, unwrapData: boolean = true) =>
    request<T>(endpoint, { method: 'GET', params, cacheTtlMs, unwrapData })
};

export default http;
