import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { createSecureHandler } from '@/lib/utils/api-security'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

const TokenConfigSchema = z.object({
  siterank: z.object({
    costPerDomain: z.number().min(0),
    batchMultiplier: z.number().min(0).max(1),
    description: z.string().optional()
  }),
  batchopen: z.object({
    costPerUrl: z.number().min(0),
    batchMultiplier: z.number().min(0).max(1),
    description: z.string().optional()
  }),
  adscenter: z.object({
    costPerLinkChange: z.number().min(0),
    batchMultiplier: z.number().min(0).max(1),
    description: z.string().optional()
  }),
  reason: z.string().optional()
})

async function handleGET(request: NextRequest, { user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  // Get current token configuration
  const config = await prisma.environmentVariable.findMany({
    where: {
      key: {
        in: [
          'TOKEN_COST_SITERANK',
          'TOKEN_COST_BATCHOPEN', 
          'TOKEN_COST_CHANGELINK',
          'TOKEN_BATCH_MULTIPLIER_SITERANK',
          'TOKEN_BATCH_MULTIPLIER_BATCHOPEN',
          'TOKEN_BATCH_MULTIPLIER_CHANGELINK'
        ]
      }
    }
  })

  // Transform to expected format
  const tokenConfig = {
    siterank: {
      costPerDomain: parseFloat(config.find((c: any) => c.key === 'TOKEN_COST_SITERANK')?.value || '1'),
      batchMultiplier: parseFloat(config.find((c: any) => c.key === 'TOKEN_BATCH_MULTIPLIER_SITERANK')?.value || '0.8'),
      description: 'Website ranking analysis - cost per domain'
    },
    batchopen: {
      costPerUrl: parseFloat(config.find((c: any) => c.key === 'TOKEN_COST_BATCHOPEN')?.value || '1'),
      batchMultiplier: parseFloat(config.find((c: any) => c.key === 'TOKEN_BATCH_MULTIPLIER_BATCHOPEN')?.value || '0.8'),
      description: 'Batch URL opening - cost per URL'
    },
    adscenter: {
      costPerLinkChange: parseFloat(config.find((c: any) => c.key === 'TOKEN_COST_CHANGELINK')?.value || '2'),
      batchMultiplier: parseFloat(config.find((c: any) => c.key === 'TOKEN_BATCH_MULTIPLIER_CHANGELINK')?.value || '0.8'),
      description: 'Google Ads link changes - cost per link change'
    }
  }

  return NextResponse.json({
    success: true,
    data: tokenConfig
  })
}

async function handlePUT(request: NextRequest, { validatedData, user }: any) {
  // Check if user is admin
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    )
  }

  const { siterank, batchopen, adscenter, reason } = validatedData.body

  // Get current configuration for logging
  const currentConfig = await prisma.environmentVariable.findMany({
    where: {
      key: {
        in: [
          'TOKEN_COST_SITERANK',
          'TOKEN_COST_BATCHOPEN', 
          'TOKEN_COST_CHANGELINK',
          'TOKEN_BATCH_MULTIPLIER_SITERANK',
          'TOKEN_BATCH_MULTIPLIER_BATCHOPEN',
          'TOKEN_BATCH_MULTIPLIER_CHANGELINK'
        ]
      }
    }
  })

  const oldConfig = {
    siterank: {
      costPerDomain: parseFloat(currentConfig.find((c: any) => c.key === 'TOKEN_COST_SITERANK')?.value || '1'),
      batchMultiplier: parseFloat(currentConfig.find((c: any) => c.key === 'TOKEN_BATCH_MULTIPLIER_SITERANK')?.value || '0.8'),
    },
    batchopen: {
      costPerUrl: parseFloat(currentConfig.find((c: any) => c.key === 'TOKEN_COST_BATCHOPEN')?.value || '1'),
      batchMultiplier: parseFloat(currentConfig.find((c: any) => c.key === 'TOKEN_BATCH_MULTIPLIER_BATCHOPEN')?.value || '0.8'),
    },
    adscenter: {
      costPerLinkChange: parseFloat(currentConfig.find((c: any) => c.key === 'TOKEN_COST_CHANGELINK')?.value || '2'),
      batchMultiplier: parseFloat(currentConfig.find((c: any) => c.key === 'TOKEN_BATCH_MULTIPLIER_CHANGELINK')?.value || '0.8'),
    }
  }

  // Update configuration in database
  const updates = [
    { key: 'TOKEN_COST_SITERANK', value: siterank.costPerDomain.toString() },
    { key: 'TOKEN_COST_BATCHOPEN', value: batchopen.costPerUrl.toString() },
    { key: 'TOKEN_COST_CHANGELINK', value: adscenter.costPerLinkChange.toString() },
    { key: 'TOKEN_BATCH_MULTIPLIER_SITERANK', value: siterank.batchMultiplier.toString() },
    { key: 'TOKEN_BATCH_MULTIPLIER_BATCHOPEN', value: batchopen.batchMultiplier.toString() },
    { key: 'TOKEN_BATCH_MULTIPLIER_CHANGELINK', value: adscenter.batchMultiplier.toString() }
  ]

  // Use transaction to update all values atomically
  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.environmentVariable.upsert({
        where: { key: update.key },
        update: { 
          value: update.value,
          updatedAt: new Date()
        },
        create: {
          key: update.key,
          value: update.value,
          isSecret: false,
          createdBy: user.id
        }
      })
    }

    // Log the configuration change
    await tx.config_change_history.create({
      data: {
        configKey: 'token-config',
        oldValue: JSON.stringify({ siterank: oldConfig.siterank, batchopen: oldConfig.batchopen, adscenter: oldConfig.adscenter }),
        newValue: JSON.stringify({ siterank, batchopen, adscenter }),
        changedBy: user.id,
        reason: 'Token configuration updated'
      }
    })
  })

  // Return updated configuration
  const updatedConfig = {
    siterank: {
      costPerDomain: siterank.costPerDomain,
      batchMultiplier: siterank.batchMultiplier,
      description: siterank.description || 'Website ranking analysis - cost per domain'
    },
    batchopen: {
      costPerUrl: batchopen.costPerUrl,
      batchMultiplier: batchopen.batchMultiplier,
      description: batchopen.description || 'Batch URL opening - cost per URL'
    },
    adscenter: {
      costPerLinkChange: adscenter.costPerLinkChange,
      batchMultiplier: adscenter.batchMultiplier,
      description: adscenter.description || 'Google Ads link changes - cost per link change'
    }
  }

  return NextResponse.json({
    success: true,
    data: updatedConfig,
    message: 'Token configuration updated successfully'
  })
}

export const GET = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-token-config:${session}`;
    }
  },
  handler: handleGET
});

export const PUT = createSecureHandler({
  requireAuth: true,
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (req: NextRequest) => {
      const session = req.headers.get('authorization') || 'anonymous';
      return `admin-token-config-update:${session}`;
    }
  },
  validation: {
    body: [
      { field: 'siterank', type: 'object', required: true },
      { field: 'batchopen', type: 'object', required: true },
      { field: 'adscenter', type: 'object', required: true },
      { field: 'reason', type: 'string', required: false }
    ]
  },
  handler: handlePUT
});