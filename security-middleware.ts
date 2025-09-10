import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'

export async function middleware(request: NextRequest) {
  // Skip middleware for non-feature routes
  if (!request.nextUrl.pathname.startsWith('/batchopen') && 
      !request.nextUrl.pathname.startsWith('/siterank') &&
      !request.nextUrl.pathname.startsWith('/api/batchopen') &&
      !request.nextUrl.pathname.startsWith('/api/siterank')) {
    return NextResponse.next()
  }

  try {
    const session = await auth()
    
    if (!session?.userId) {
      return NextResponse.next()
    }

    // Check if user has active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: session.userId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: new Date()
        }
      }
    })

    // If no active subscription, redirect to pricing
    if (!subscription && 
        (request.nextUrl.pathname.startsWith('/batchopen') || 
         request.nextUrl.pathname.startsWith('/siterank'))) {
      return NextResponse.redirect(new URL('/pricing', request.url))
    }

    // Track usage for API calls
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const feature = request.nextUrl.pathname.includes('batchopen') ? 'batch_open' : 'site_rank'
      
      // Increment usage count
      await prisma.usageLog.create({
        data: {
          userId: session.userId,
          feature,
          usage: 1
        }
      })
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Error in security middleware:', error)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/batchopen/:path*',
    '/siterank/:path*',
    '/api/batchopen/:path*',
    '/api/siterank/:path*',
  ],
}