export type HealthResponse = {
  status?: string;
  message?: string;
  timestamp?: unknown;
};

export function validateHealth(data: unknown): HealthResponse {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const out: HealthResponse = {};
    if (typeof obj.status === 'string') out.status = obj.status;
    if (typeof obj.message === 'string') out.message = obj.message;
    if ('timestamp' in obj) out.timestamp = obj.timestamp;
    return out;
  }
  return { status: 'unknown' };
}
