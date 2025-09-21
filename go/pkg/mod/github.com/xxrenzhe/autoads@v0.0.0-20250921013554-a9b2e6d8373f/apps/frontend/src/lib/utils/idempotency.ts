export function getIdempotencyKey(req: Request): string | null {
  const h = req.headers
  const key = h.get('Idempotency-Key') || h.get('idempotency-key') || null
  return key && key.trim() ? key.trim() : null
}

export function requireIdempotencyKey(req: Request): string {
  const key = getIdempotencyKey(req)
  if (!key) {
    throw Object.assign(new Error('Missing Idempotency-Key header'), { status: 400 })
  }
  return key
}

