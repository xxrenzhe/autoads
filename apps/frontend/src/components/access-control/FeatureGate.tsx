'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Lock, 
  Crown, 
  Zap, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'

interface FeatureAccess {
  feature: string
  hasAccess: boolean
  reason?: string
  upgradeRequired?: boolean
  usageLimit?: number
  currentUsage?: number
  resetDate?: Date
}

interface FeatureGateProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
  showUpgradePrompt?: boolean
  className?: string
}

export default function FeatureGate({ 
  feature, 
  children, 
  fallback, 
  showUpgradePrompt = true,
  className 
}: .*Props) {
  const { data: session } = useSession()
  const [access, setAccess] = useState<FeatureAccess | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user) => {
      checkAccess()
    } else {
      setAccess({
        feature,
        hasAccess: false,
        reason: 'Authentication required',
        upgradeRequired: false
      })
      setLoading(false)
    }
  }, [session, feature])

  const checkAccess = async () => {
    try {
      const response = await fetch(`/api/user/access-control/check?feature=${feature}`)
      const data = await response.json()
      
      if (data.success) => {
        setAccess(data.data)
      } else {
        setAccess({
          feature,
          hasAccess: false,
          reason: 'Unable to verify access'
        })
      }
    } catch (error) {
      console.error('Error checking feature access:', error)
      setAccess({
        feature,
        hasAccess: false,
        reason: 'Access check failed'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) => {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!access) => {
    return fallback || <div>Unable to check feature access</div>
  }

  if (access.hasAccess) => {
    return <div className={className}>{children}</div>
  }

  // Show custom fallback if provided
  if (fallback) => {
    return <div className={className}>{fallback}</div>
  }

  // Show upgrade prompt for premium features
  if (access.upgradeRequired && showUpgradePrompt) => {
    return (
      <div className={className}>
        <UpgradePrompt access={access} />
      </div>
    )
  }

  // Show usage limit reached
  if (access.usageLimit && access.currentUsage !== undefined) => {
    return (
      <div className={className}>
        <UsageLimitReached access={access} />
      </div>
    )
  }

  // Show authentication required
  if (!session) => {
    return (
      <div className={className}>
        <AuthenticationRequired feature={feature} />
      </div>
    )
  }

  // Default blocked state
  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Feature Unavailable
          </CardTitle>
          <CardDescription>
            {access.reason || 'This feature is not available in your current plan'}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function UpgradePrompt({ access }: { access: FeatureAccess }) => {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          Upgrade Required
        </CardTitle>
        <CardDescription>
          {access.reason || 'This feature requires a premium plan'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Unlock unlimited access
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Priority support
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Advanced analytics
          </div>
          
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href="/pricing">
                <Zap className="h-4 w-4 mr-2" />
                Upgrade Now
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">
                View Plans
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function UsageLimitReached({ access }: { access: FeatureAccess }) => {
  const usagePercentage = access.usageLimit && access.currentUsage !== undefined
    ? (access.currentUsage / access.usageLimit) * 100
    : 0

  const resetTime = access.resetDate ? new Date(access.resetDate).toLocaleDateString() : 'Unknown'

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Usage Limit Reached
        </CardTitle>
        <CardDescription>
          {access.reason || 'You have reached your usage limit for this feature'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {access.usageLimit && access.currentUsage !== undefined && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Usage</span>
                <span>{access.currentUsage} / {access.usageLimit}</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Resets on {resetTime}
          </div>
          
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              Upgrade to Pro for unlimited access and remove all usage limits.
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href="/pricing">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/tokens">
                View Usage
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AuthenticationRequired({ feature }: { feature: string }) => {
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-blue-600" />
          Sign In Required
        </CardTitle>
        <CardDescription>
          Please sign in to access {feature} features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Create a free account to get started with:
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              100 free tokens per month
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Access to all core features
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Community support
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href="/auth/signin">
                Sign In
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/auth/signin">
                Create Account
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Hook for checking feature access
export function useFeatureAccess(feature: string) => {
  const { data: session } = useSession()
  const [access, setAccess] = useState<FeatureAccess | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user) => {
      checkAccess()
    } else {
      setAccess({
        feature,
        hasAccess: false,
        reason: 'Authentication required'
      })
      setLoading(false)
    }
  }, [session, feature])

  const checkAccess = async () => {
    try {
      const response = await fetch(`/api/user/access-control/check?feature=${feature}`)
      const data = await response.json()
      
      if (data.success) => {
        setAccess(data.data)
      }
    } catch (error) {
      console.error('Error checking feature access:', error)
    } finally {
      setLoading(false)
    }
  }

  return { access, loading, refetch: checkAccess }
}