import { PrismaClient } from './types/prisma-types'

const globalForPrisma = globalThis as any & {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma