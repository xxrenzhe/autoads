import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// Base64 URL safe encoding (without padding)
function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export interface InternalJwtClaims {
  sub: string
  role?: string
  planId?: string
  planTier?: string
  scope?: string[]
  featureFlagsHash?: string
}

export function createInternalJWT(claims: InternalJwtClaims): string | null {
  let privateKey = process.env.INTERNAL_JWT_PRIVATE_KEY
  // 开发/容器兜底：支持从文件读取密钥（避免手工复制多行 PEM）
  if (!privateKey) {
    const fileFromEnv = process.env.INTERNAL_JWT_PRIVATE_KEY_FILE
    const candidates: string[] = []
    if (fileFromEnv) candidates.push(fileFromEnv)
    // 容器默认位置
    candidates.push('/app/.keys/internal-jwt-private.pem')
    // 本地开发默认位置（在 apps/frontend 目录运行时）
    candidates.push(path.join(process.cwd(), '.keys', 'internal-jwt-private.pem'))
    for (const f of candidates) {
      try {
        if (fs.existsSync(f)) {
          privateKey = fs.readFileSync(f, 'utf8')
          break
        }
      } catch {}
    }
  }
  if (!privateKey) return null

  const iss = process.env.INTERNAL_JWT_ISS || 'autoads-next'
  const aud = process.env.INTERNAL_JWT_AUD || 'internal-go'
  const ttlSec = Number(process.env.INTERNAL_JWT_TTL_SECONDS || '120')

  const nowSec = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload: Record<string, any> = {
    iss,
    aud,
    sub: claims.sub,
    iat: nowSec,
    exp: nowSec + Math.max(60, Math.min(ttlSec, 900)), // clamp to [60s, 15m]
    jti: crypto.randomUUID(),
  }
  if (claims.role) payload.role = claims.role
  if (claims.planId) payload.planId = claims.planId
  if (claims.planTier) payload.planTier = claims.planTier
  if (claims.scope) payload.scope = claims.scope
  if (claims.featureFlagsHash) payload.featureFlagsHash = claims.featureFlagsHash

  const headerPart = b64url(JSON.stringify(header))
  const payloadPart = b64url(JSON.stringify(payload))
  const signingInput = `${headerPart}.${payloadPart}`

  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()

  try {
    const signature = signer.sign(privateKey)
    const sigPart = b64url(signature)
    return `${signingInput}.${sigPart}`
  } catch {
    return null
  }
}

export function ensureIdempotencyKey(method: string, headers: Headers): string | null {
  if (method === 'GET' || method === 'HEAD') return null
  const existing = headers.get('idempotency-key') || headers.get('Idempotency-Key')
  if (existing) return existing
  const key = crypto.randomUUID()
  headers.set('Idempotency-Key', key)
  return key
}

export function ensureRequestId(headers: Headers): string {
  const existing = headers.get('x-request-id')
  if (existing) return existing
  const id = crypto.randomUUID()
  headers.set('x-request-id', id)
  return id
}
