import { NextRequest, NextResponse } from 'next/server'
import { PlanService } from '@/lib/services/plan-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

/**
 * GET /api/plans - Get public plans (no authentication required)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const currency = searchParams.get('currency') || 'USD'
    const interval = searchParams.get('interval') as 'MONTH' | 'YEAR' | null

    // Get all active plans
    const allPlans = await PlanService.getAllPlans(false)

    // Filter by currency and interval if specified
    let filteredPlans = allPlans.filter((plan: any) => plan.currency === currency)
    
    if (interval) {
      filteredPlans = filteredPlans.filter((plan: any) => plan.interval === interval)
    }

    // Format plans for public consumption (remove sensitive data)
    const publicPlans = filteredPlans?.filter(Boolean)?.map((plan: any) => {
      // Safely extract features from JSON
      const features = plan.features as Record<string, unknown> || {};
      
      return {
        id: plan.id,
        name: plan.name,
        displayName: (plan.metadata as any)?.displayName || plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        billingPeriod: plan.billingPeriod,
        tokenQuota: plan.tokenQuota,
        features: {
          siterank: features.siterank as boolean || false,
          batchopen: features.batchopen as boolean || false,
          adscenter: features.adscenter as boolean || false,
          analytics: features.analytics as boolean || false,
          support: features.support as string || 'none'
        },
        // Don't expose Stripe price IDs to public
        popular: plan.name === 'pro' // Mark Pro as popular
      };
    })

    // Sort by price
    publicPlans.sort((a, b) => a.price - b.price)

    const response = NextResponse.json({
      success: true,
      data: {
        plans: publicPlans,
        currency,
        interval: interval || 'MONTH'
      },
      message: 'Plans retrieved successfully'
    })
    
    // Add caching headers - plans don't change frequently
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=300')
    
    return response
  } catch (error) {
    console.error('Failed to get public plans:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve plans'
    }, { status: 500 })
  }
}