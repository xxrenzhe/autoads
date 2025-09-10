import { PrismaClient, SubscriptionStatus } from './types/prisma-types'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()
export { SubscriptionStatus }

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma