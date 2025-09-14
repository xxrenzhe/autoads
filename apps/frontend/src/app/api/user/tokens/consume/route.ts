import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { recordTokenUsage } from '@/lib/services/token-usage'
import { z } from 'zod'

const ConsumeTokenSchema = z.object({
  feature: z.enum(['BATCHOPEN', 'SITERANK', 'CHANGELINK']),
  operation: z.string(),
  tokens: z.number().positive(),
  itemCount: z.number().positive().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await (auth as any)()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = ConsumeTokenSchema.parse(body)

    console.log('Token consumption request:', {
      userId: session.user.id,
      userEmail: session.user.email,
      feature: validatedData.feature,
      tokens: validatedData.tokens
    })

    // Ensure user exists in database
    let user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      console.log(`User not found in database, creating user: ${session.user.id}`)
      
      // Create user with data from session
      user = await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.name || null,
          avatar: session.user.image || null,
          emailVerified: session.user.emailVerified || false,
          role: 'USER',
          status: 'ACTIVE',
        }
      })

      // Create subscription for the new user
      try {
        const proPlan = await prisma.plan.findFirst({
          where: { name: 'pro', isActive: true }
        })
        
        if (proPlan) {
          const { SubscriptionHelper } = await import('@/lib/services/subscription-helper')
          const trialSubscription = await SubscriptionHelper.createTrialSubscription(user.id, proPlan.id)
          
          await prisma.user.update({
            where: { id: user.id },
            data: {
              trialUsed: true,
            }
          })
          
          console.log(`Created 14-day Pro trial subscription for user: ${user.email}`)
        } else {
          // Fallback to free plan
          const freePlan = await prisma.plan.findFirst({
            where: { name: 'free', isActive: true }
          })
          
          if (freePlan) {
            const startDate = new Date()
            const endDate = new Date()
            endDate.setFullYear(endDate.getFullYear() + 10)
            
            await prisma.subscription.create({
              data: {
                userId: user.id,
                planId: freePlan.id,
                status: 'ACTIVE',
                currentPeriodStart: startDate,
                currentPeriodEnd: endDate,
                provider: 'system',
                providerSubscriptionId: `free_${user.id}_${Date.now()}`
              }
            })
            
            await prisma.user.update({
              where: { id: user.id },
              data: {
                subscriptionTokenBalance: freePlan.tokenQuota,
                tokenBalance: Math.max(user.tokenBalance || 0, freePlan.tokenQuota)
              }
            })
            
            console.log(`Created free subscription for user: ${user.email}`)
          }
        }
      } catch (error) {
        console.error('Error creating subscription for new user:', error)
      }
    }

    // 记录Token使用
    const result = await recordTokenUsage({
      userId: session.user.id,
      feature: validatedData.feature,
      operation: validatedData.operation,
      tokensUsed: validatedData.tokens,
      itemCount: validatedData.itemCount,
      description: validatedData.description,
      metadata: validatedData.metadata
    })

    return NextResponse.json({
      success: true,
      remainingBalance: result.remainingBalance,
      consumed: validatedData.tokens
    })
  } catch (error) {
    console.error('Token consumption error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return NextResponse.json(
          { error: 'User account not found. Please try logging out and back in.' },
          { status: 404 }
        )
      }
      
      if (error.message === 'Insufficient token balance') {
        return NextResponse.json(
          { error: 'Insufficient token balance', code: 'INSUFFICIENT_TOKENS' },
          { status: 402 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
