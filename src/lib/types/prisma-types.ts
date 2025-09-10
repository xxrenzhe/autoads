// Export Prisma types for consistent imports across the application
import { PrismaClient, UserRole, UserStatus, Interval, SubscriptionStatus, PaymentStatus, tokenusagefeature, Prisma } from '@prisma/client'

// Export Prisma client and enums
export {
  PrismaClient,
  UserRole,
  UserStatus,
  Interval,
  SubscriptionStatus,
  PaymentStatus,
  tokenusagefeature,
  Prisma
}

// Export model types if needed in the future
// Note: These types are not directly exported from @prisma/client
// Use Prisma.PlanGetPayload, Prisma.SystemConfigGetPayload, etc. directly