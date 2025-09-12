import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { createSecureHandler } from '@/lib/utils/api-security'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const CalculateSchema = z.object({
  feature: z.enum(['siterank', 'batchopen', 'adscenter']),
  itemCount: z.number().min(1).max(10000),
  isBatch: z.boolean().default(false)
})

async function handlePOST(request: NextRequest, { validatedData, user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  const { feature, itemCount, isBatch } = validatedData.body

  // Get current token configuration
  const config = await prisma.environmentVariable.findMany({
    where: {
      key: {
        in: [
          `TOKEN_COST_${feature.toUpperCase()}`,
          `TOKEN_BATCH_MULTIPLIER_${feature.toUpperCase()}`
        ]
      }
    }
  })

  const baseCostPerItem = parseFloat(
    config.find(c => c.key === `TOKEN_COST_${feature.toUpperCase()}`)?.value || '1'
  )
  const batchMultiplier = parseFloat(
    config.find(c => c.key === `TOKEN_BATCH_MULTIPLIER_${feature.toUpperCase()}`)?.value || '0.8'
  )

  // Calculate costs
  const baseCost = baseCostPerItem * itemCount
  const finalCost = isBatch ? Math.ceil(baseCost * batchMultiplier) : baseCost
  const savings = isBatch ? baseCost - finalCost : 0

  const result = {
    feature,
    itemCount,
    isBatch,
    tokenCost: finalCost,
    baseCostPerItem,
    batchMultiplier,
    calculation: {
      baseCost,
      afterBatchDiscount: finalCost,
      savings
    }
  }

  return NextResponse.json({
    success: true,
    data: result
  })
}

export const POST = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-token-calculate:${session}`;
    }
  },
  validation: {
    body: [
      { field: 'feature', type: 'string', required: true, enum: ['siterank', 'batchopen', 'adscenter'] },
      { field: 'itemCount', type: 'number', required: true, min: 1, max: 10000 },
      { field: 'isBatch', type: 'boolean', required: false, default: false }
    ]
  },
  handler: handlePOST
});