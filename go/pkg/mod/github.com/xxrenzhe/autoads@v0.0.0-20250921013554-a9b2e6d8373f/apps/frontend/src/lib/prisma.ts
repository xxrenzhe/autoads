import { PrismaClient } from './types/prisma-types'

const globalForPrisma = globalThis as any & {
  prisma: PrismaClient | undefined
}

const baseClient: PrismaClient = globalForPrisma.prisma ?? new PrismaClient()

// Read-only guard for business domain writes from Next layer
function guardEnabled() {
  const env = (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || process.env.NODE_ENV || '').toLowerCase()
  if (process.env.NEXT_PRISMA_GUARD === 'false') return false
  return env === 'production' || env === 'preview'
}

const ALLOWED_WRITE_MODELS = new Set([
  'user',
  'account',
  'session',
  'verificationToken',
  'userDevice',
])

const WRITE_METHODS = new Set([
  'create','update','delete','deleteMany','updateMany','upsert','createMany',
  '$executeRaw','$queryRaw','executeRaw','queryRaw','executeRawUnsafe','queryRawUnsafe'
])

// Proxy that blocks write methods on non-whitelisted models in production/preview
export const prisma: PrismaClient = new Proxy(baseClient as any, {
  get(target, prop: string, receiver) {
    const model = Reflect.get(target, prop, receiver)
    if (typeof model === 'object' && model) {
      return new Proxy(model, {
        get(mTarget, method: string, mReceiver) {
          const fn = Reflect.get(mTarget, method, mReceiver)
          if (typeof fn === 'function' && WRITE_METHODS.has(method) && guardEnabled()) {
            const modelName = String(prop)
            if (!ALLOWED_WRITE_MODELS.has(modelName)) {
              return () => {
                throw new Error(`Prisma write blocked on model '${modelName}' via method '${method}' in Next layer`)
              }
            }
          }
          return fn
        }
      })
    }
    return model
  }
}) as PrismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
