'use server'

import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'
import { StripeService } from '@/lib/payments/stripe'
import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'

// Server Action for creating subscription
export async function createSubscription(formData: FormData) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const planId = formData.get('planId') as string
  
  if (!planId) {
    throw new Error('Plan ID is required')
  }

  try {
    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: session.user!.id,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: new Date()
        }
      }
    })

    if (existingSubscription) {
      throw new Error('You already have an active subscription')
    }

    // Get the plan details
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    })

    if (!plan || !plan.isActive) {
      throw new Error('Invalid plan')
    }

    if (!plan.stripePriceId) {
      throw new Error('Stripe price ID not configured for this plan')
    }

    // Get or create Stripe customer
    let user = await prisma.user.findUnique({
      where: { id: session.user!.id },
      select: { stripeCustomerId: true, email: true, name: true }
    })

    let stripeCustomerId = user?.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await StripeService.createCustomer({
        email: user!.email!,
        name: user!.name || undefined
      })
      stripeCustomerId = customer.id
      
      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: session.user!.id },
        data: { stripeCustomerId }
      })
    }

    // Create Stripe checkout session
    const successUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/dashboard?success=true`
    const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/pricing?canceled=true`

    // Use the Stripe price ID from the plan
    const stripePriceId = plan.stripePriceId as string

    const checkoutSession = await StripeService.createCheckoutSession({
      customerId: stripeCustomerId!,
      priceId: stripePriceId,
      successUrl,
      cancelUrl
    })

    // Create pending subscription record
    await prisma.subscription.create({
      data: {
        userId: session.user!.id,
        planId,
        status: 'PENDING',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        provider: 'stripe',
        providerSubscriptionId: checkoutSession.id
      }
    })

    // Revalidate user data cache
    revalidateTag('subscription')
    
    // Redirect to Stripe Checkout
    redirect(checkoutSession.url!)
  } catch (error) {
    console.error('Error creating subscription:', error)
    throw error
  }
}

// Server Action for updating user role
export async function updateUserRole(userId: string, role: string) {
  const session = await auth()
  
  if (!session?.user?.id || (session.user?.role !== 'ADMIN' && session.user?.role !== 'SUPER_ADMIN')) {
    throw new Error('Unauthorized')
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: role as any }
    })

    // Revalidate user cache
    revalidateTag('user')
    
    return { success: true }
  } catch (error) {
    console.error('Error updating user role:', error)
    throw error
  }
}

// Server Action for updating user status
export async function updateUserStatus(userId: string, status: string) {
  const session = await auth()
  
  if (!session?.user?.id || (session.user?.role !== 'ADMIN' && session.user?.role !== 'SUPER_ADMIN')) {
    throw new Error('Unauthorized')
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: status as any }
    })

    // Revalidate user cache
    revalidateTag('user')
    
    return { success: true }
  } catch (error) {
    console.error('Error updating user status:', error)
    throw error
  }
}

// Server Action for canceling subscription
export async function cancelSubscription(subscriptionId: string, immediately = false) {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  try {
    // Get subscription from database
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: session.user!.id,
        provider: 'stripe'
      }
    })

    if (!subscription) {
      throw new Error('Subscription not found')
    }

    // Cancel subscription in Stripe
    await StripeService.cancelSubscription(
      subscription.providerSubscriptionId!,
      immediately
    )

    // Update local subscription status
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: immediately ? 'CANCELED' : 'ACTIVE',
        // If not immediate, Stripe will cancel at period end
        // The webhook will update the status when it actually cancels
      }
    })

    revalidateTag('subscription')
    
    return { success: true, subscription: updatedSubscription }
  } catch (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }
}

// Server Action for creating customer portal session
export async function createCustomerPortalSession() {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  try {
    // Get user with Stripe customer ID
    const user = await prisma.user.findUnique({
      where: { id: session.user!.id },
      select: { stripeCustomerId: true }
    })

    if (!user?.stripeCustomerId) {
      throw new Error('No Stripe customer found')
    }

    // Create portal session
    const returnUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const portalSession = await StripeService.createPortalSession(
      user.stripeCustomerId,
      returnUrl
    )

    return { url: portalSession.url }
  } catch (error) {
    console.error('Error creating portal session:', error)
    throw error
  }
}

// Server Action for deleting user
export async function deleteUser(userId: string) {
  const session = await auth()
  
  if (!session?.userId || (session.user?.role !== 'ADMIN' && session.user?.role !== 'SUPER_ADMIN')) {
    throw new Error('Unauthorized')
  }

  if (userId === session.userId) {
    throw new Error('Cannot delete your own account')
  }

  try {
    await prisma.user.delete({
      where: { id: userId }
    })

    // Revalidate caches
    revalidateTag('user')
    revalidateTag('subscription')
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}
