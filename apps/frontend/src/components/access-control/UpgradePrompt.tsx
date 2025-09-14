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
  Crown, 
  Zap, 
  TrendingUp, 
  Star,
  CheckCircle,
  X,
  ArrowRight
} from 'lucide-react'
import { http } from '@/shared/http/client'

interface UpgradeSuggestion {
  shouldUpgrade: boolean
  reasons: string[]
  recommendedPlan: string
  savings?: number
}

interface UpgradePromptProps {
  trigger?: 'usage_limit' | 'feature_access' | 'proactive'
  feature?: string
  onDismiss?: () => void
  className?: string
}

export default function UpgradePrompt({ 
  trigger = 'proactive', 
  feature,
  onDismiss,
  className 
}: UpgradePromptProps) {
  const { data: session } = useSession()
  const [suggestion, setSuggestion] = useState<UpgradeSuggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (session?.user) {
      fetchUpgradeSuggestion()
    } else {
      setLoading(false)
    }
  }, [session])

  const fetchUpgradeSuggestion = async () => {
    try {
      const data = await http.getCached<{ success: boolean; data: UpgradeSuggestion }>(
        '/user/access-control/upgrade-suggestions',
        undefined,
        60_000,
        true
      )
      if ((data as any)?.shouldUpgrade !== undefined || (data as any)?.data) {
        // unwrapData=true 时 data 已是 UpgradeSuggestion
        setSuggestion((data as any).shouldUpgrade !== undefined ? (data as any) : (data as any).data)
      }
    } catch (error) {
      console.error('Error fetching upgrade suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  if (loading || dismissed || !suggestion?.shouldUpgrade) {
    return null
  }

  const getPromptContent = () => {
    switch (trigger) {
      case 'usage_limit':
        return {
          title: 'Usage Limit Reached',
          description: 'You\'ve hit your free tier limits. Upgrade to continue using all features.',
          icon: TrendingUp,
          variant: 'warning' as const
        }
      case 'feature_access':
        return {
          title: 'Premium Feature',
          description: `${feature} is available in Pro and Max plans.`,
          icon: Crown,
          variant: 'premium' as const
        }
      default:
        return {
          title: 'Ready to Upgrade?',
          description: 'Based on your usage patterns, you might benefit from a Pro plan.',
          icon: Star,
          variant: 'suggestion' as const
        }
    }
  }

  const content = getPromptContent()

  return (
    <Card className={`relative ${getVariantStyles(content.variant)} ${className}`}>
      {onDismiss && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <content.icon className="h-5 w-5" />
          {content.title}
        </CardTitle>
        <CardDescription>
          {content.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Reasons for upgrade */}
        {suggestion.reasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Why upgrade now:</p>
            <ul className="space-y-1">
              {suggestion.reasons.slice(0, 3).map((reason, index: any) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Pro plan includes:</p>
          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-3 w-3 text-green-500" />
              5,000 tokens per month
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Unlimited feature access
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Priority support
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Advanced analytics
            </div>
          </div>
        </div>

        {/* Savings badge */}
        {suggestion.savings && (
          <Alert className="border-green-200 bg-green-50">
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              Save {suggestion.savings}% with annual billing
            </AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link href="/pricing">
              <Zap className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pricing">
              Compare Plans
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function getVariantStyles(variant: 'warning' | 'premium' | 'suggestion') {
  switch (variant) {
    case 'warning':
      return 'border-yellow-200 bg-yellow-50'
    case 'premium':
      return 'border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10'
    case 'suggestion':
      return 'border-blue-200 bg-blue-50'
    default:
      return ''
  }
}

// Compact upgrade prompt for inline use
export function CompactUpgradePrompt({ 
  feature, 
  className 
}: { 
  feature?: string
  className?: string 
}) {
  return (
    <div className={`flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 ${className}`}>
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          {feature ? `${feature} requires Pro` : 'Upgrade to Pro'}
        </span>
      </div>
      <Button size="sm" asChild>
        <Link href="/pricing">
          Upgrade
        </Link>
      </Button>
    </div>
  )
}

// Usage progress indicator
export function UsageProgress({ 
  current, 
  limit, 
  feature,
  className 
}: { 
  current: number
  limit: number
  feature: string
  className?: string 
}) {
  const percentage = (current / limit) * 100
  const isNearLimit = percentage >= 80

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize">{feature} usage</span>
        <span className={isNearLimit ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}>
          {current} / {limit}
        </span>
      </div>
      <Progress 
        value={percentage} 
        className={`h-2 ${isNearLimit ? 'bg-yellow-100' : ''}`}
      />
      {isNearLimit && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-yellow-600">
            Approaching limit
          </span>
          <Button size="sm" variant="outline" asChild>
            <Link href="/pricing">
              Upgrade
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
