'use client'
import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  Check,
  X,
  Zap,
  Users,
  Settings,
  DollarSign,
  Calendar,
  Star,
  Shield,
  Smartphone,
  Globe
} from 'lucide-react'
import { useSubscriptionManagement } from '../hooks/useSubscriptionManagement'

export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  features: string[]
  limits: {
    tokens: number
    users: number
    apiCalls: number
    storage: number
  }
  popular: boolean
  active: boolean
  trialDays?: number
  stripePriceId?: string
  createdAt: string
  updatedAt: string
}

export interface PlanManagerProps {
  onPlanSelect?: (plan: SubscriptionPlan) => void
  adminMode?: boolean
}

export function PlanManager({ onPlanSelect, adminMode = false }: PlanManagerProps) {
  const {
    plans,
    isLoading,
    error,
    createPlan,
    updatePlan,
    deletePlan,
    togglePlanStatus,
    isCreating,
    isUpdating,
    isDeleting
  } = useSubscriptionManagement()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set())
  const [announcement, setAnnouncement] = useState<string>('')
  const planCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Announce changes to screen readers
  const announceToScreenReader = (message: string) => {
    setAnnouncement(message)
    setTimeout(() => setAnnouncement(''), 1000)
  }

  // Effect to announce loading state changes
  useEffect(() => {
    if (isLoading) {
      announceToScreenReader('Loading subscription plans')
    } else if (plans.length > 0) {
      announceToScreenReader(`${plans.length} subscription plans loaded`)
    }
  }, [isLoading, plans.length])

  // Focus management for dynamic content
  useEffect(() => {
    if (plans.length > 0 && !isLoading) {
      // Focus first plan card when plans load
      const firstPlan = plans[0]
      const firstPlanRef = planCardRefs.current.get(firstPlan.id)
      if (firstPlanRef && document.activeElement === document.body) {
        firstPlanRef.focus()
      }
    }
  }, [plans, isLoading])

  const formatPrice = (price: number, currency: string, interval: string) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(price / 100)
    return `${formatted}/${interval}`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const handlePlanSelect = (planId: string) => {
    const newSelected = new Set(selectedPlans)
    const plan = plans.find((p: any) => p.id === planId)
    const planName = plan?.name || 'plan'
    
    if (newSelected.has(planId)) {
      newSelected.delete(planId)
      announceToScreenReader(`${planName} deselected`)
    } else {
      newSelected.add(planId)
      announceToScreenReader(`${planName} selected`)
    }
    setSelectedPlans(newSelected)
  }

  // Handle keyboard navigation for plan cards
  const handlePlanCardKeyDown = (event: React.KeyboardEvent, plan: SubscriptionPlan) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (adminMode) {
        handlePlanSelect(plan.id)
      } else {
        onPlanSelect?.(plan)
      }
    }
  }

  const handleCreatePlan = () => {
    setShowCreateForm(true)
    setEditingPlan(null)
  }

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setShowCreateForm(true)
  }

  const handleDeletePlan = async (planId: string) => {
    const plan = plans.find((p: any) => p.id === planId)
    const planName = plan?.name || 'plan'
    
    if (window.confirm(`Are you sure you want to delete the ${planName} plan? This action cannot be undone.`)) {
      try {
        await deletePlan(planId)
        announceToScreenReader(`${planName} plan deleted successfully`)
      } catch (error) {
        console.error('Error deleting plan:', error)
        announceToScreenReader(`Error deleting ${planName} plan`)
      }
    }
  }

  const handleToggleStatus = async (planId: string) => {
    try {
      await togglePlanStatus(planId)
    } catch (error) {
      console.error('Error toggling plan status:', error)
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div 
            className="text-center text-red-600"
            role="alert"
            aria-live="assertive"
          >
            <p>Error loading subscription plans: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Live region for announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        id="plan-manager-announcements"
      >
        {announcement}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {adminMode ? 'Plan Management' : 'Choose Your Plan'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {adminMode 
              ? 'Create and manage subscription plans'
              : 'Select the perfect plan for your needs'
            }
          </p>
        </div>
        {adminMode && (
          <Button 
            onClick={handleCreatePlan}
            aria-label="Create new subscription plan"
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Create Plan
          </Button>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div role="status" aria-label="Loading subscription plans">
            {Array.from({ length: 3 }).map((_, index: number) => (
              <Card key={index} className="animate-pulse" aria-hidden="true">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-8 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-300 rounded w-full"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-300 rounded w-full"></div>
                      <div className="h-3 bg-gray-300 rounded w-5/6"></div>
                      <div className="h-3 bg-gray-300 rounded w-4/6"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <span className="sr-only">Loading subscription plans...</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" aria-hidden="true" />
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No plans available
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {adminMode 
                    ? 'Create your first subscription plan to get started.'
                    : 'No subscription plans are currently available.'
                  }
                </p>
                {adminMode && (
                  <Button 
                    onClick={handleCreatePlan} 
                    className="mt-4"
                    aria-label="Create your first subscription plan"
                  >
                    <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                    Create Plan
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          plans.map((plan: any) => (
            <Card 
              key={plan.id}
              ref={(el) => {
                if (el) {
                  planCardRefs.current.set(plan.id, el)
                } else {
                  planCardRefs.current.delete(plan.id)
                }
              }}
              className={`relative transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''
              } ${selectedPlans.has(plan.id) ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${plan.name} plan. ${formatPrice(plan.price, plan.currency, plan.interval)}. ${plan.description}${plan.popular ? '. Most popular plan' : ''}${!plan.active ? '. Currently unavailable' : ''}`}
              aria-pressed={adminMode ? selectedPlans.has(plan.id) : undefined}
              aria-selected={selectedPlans.has(plan.id)}
              onKeyDown={(e) => handlePlanCardKeyDown(e, plan)}
              onClick={() => (adminMode ? handlePlanSelect(plan.id) : onPlanSelect?.(plan))}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge 
                    className="bg-blue-600 text-white px-3 py-1"
                    aria-label="Most popular plan"
                  >
                    <Star className="h-3 w-3 mr-1" aria-hidden="true" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle 
                  className="text-xl font-bold text-gray-900 dark:text-white"
                  id={`plan-${plan.id}-title`}
                >
                  {plan.name}
                </CardTitle>
                <div className="mt-2">
                  <span 
                    className="text-3xl font-bold text-gray-900 dark:text-white"
                    aria-label={`Price: ${formatPrice(plan.price, plan.currency, plan.interval)}`}
                  >
                    {formatPrice(plan.price, plan.currency, plan.interval)}
                  </span>
                </div>
                <p 
                  className="text-gray-600 dark:text-gray-400 mt-2"
                  id={`plan-${plan.id}-description`}
                >
                  {plan.description}
                </p>
                {plan.trialDays && (
                  <Badge 
                    variant="outline" 
                    className="mt-2"
                    aria-label={`${plan.trialDays} days free trial included`}
                  >
                    {plan.trialDays} days free trial
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                {/* Features */}
                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-3 text-sm" role="list" aria-label="Plan limits">
                    <div className="flex items-center" role="listitem">
                      <Zap className="h-4 w-4 text-blue-500 mr-2" aria-hidden="true" />
                      <span aria-label={`${formatNumber(plan.limits.tokens)} tokens included`}>
                        {formatNumber(plan.limits.tokens)} tokens
                      </span>
                    </div>
                    <div className="flex items-center" role="listitem">
                      <Users className="h-4 w-4 text-green-500 mr-2" aria-hidden="true" />
                      <span aria-label={`${formatNumber(plan.limits.users)} users allowed`}>
                        {formatNumber(plan.limits.users)} users
                      </span>
                    </div>
                    <div className="flex items-center" role="listitem">
                      <Globe className="h-4 w-4 text-purple-500 mr-2" aria-hidden="true" />
                      <span aria-label={`${formatNumber(plan.limits.apiCalls)} API calls included`}>
                        {formatNumber(plan.limits.apiCalls)} API calls
                      </span>
                    </div>
                    <div className="flex items-center" role="listitem">
                      <Shield className="h-4 w-4 text-orange-500 mr-2" aria-hidden="true" />
                      <span aria-label={`${formatNumber(plan.limits.storage)} gigabytes of storage`}>
                        {formatNumber(plan.limits.storage)}GB storage
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                      Features included:
                    </h3>
                    <ul className="space-y-1" aria-label={`Features included in ${plan.name} plan`}>
                      {plan.features?.slice(0, 4).map((feature, index: number) => (
                        <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <Check className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                      {plan.features?.length > 4 && (
                        <li className="text-sm text-gray-500" aria-label={`Plus ${plan.features?.length - 4} additional features`}>
                          +{plan.features?.length - 4} more features
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {adminMode ? (
                    <fieldset className="flex items-center space-x-2">
                      <legend className="sr-only">Plan management actions for {plan.name}</legend>
                      <input
                        type="checkbox"
                        checked={selectedPlans.has(plan.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          handlePlanSelect(plan.id)
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Select ${plan.name} plan for bulk actions`}
                        aria-describedby={`plan-${plan.id}-description`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditPlan(plan)
                        }}
                        className="flex-1"
                        aria-label={`Edit ${plan.name} plan`}
                      >
                        <Edit className="h-4 w-4 mr-1" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleStatus(plan.id)
                        }}
                        className={plan.active ? 'text-red-600' : 'text-green-600'}
                        aria-label={`${plan.active ? 'Deactivate' : 'Activate'} ${plan.name} plan`}
                      >
                        {plan.active ? (
                          <X className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeletePlan(plan.id)
                        }}
                        className="text-red-600"
                        aria-label={`Delete ${plan.name} plan`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </fieldset>
                  ) : (
                    <Button
                      className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPlanSelect?.(plan)
                      }}
                      disabled={!plan.active}
                      aria-label={`Choose ${plan.name} plan${!plan.active ? ' (currently unavailable)' : ''}`}
                    >
                      {plan.active ? 'Choose Plan' : 'Unavailable'}
                    </Button>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-gray-500">
                  <span aria-label={`Plan status: ${plan.active ? 'Active' : 'Inactive'}`}>
                    Status: {plan.active ? 'Active' : 'Inactive'}
                  </span>
                  <span aria-label={`Last updated on ${new Date(plan.updatedAt).toLocaleDateString()}`}>
                    Updated {new Date(plan.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Bulk Actions */}
      {adminMode && selectedPlans.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span 
                className="text-sm text-gray-600"
                aria-live="polite"
                aria-label={`${selectedPlans.size} plan${selectedPlans.size !== 1 ? 's' : ''} selected for bulk actions`}
              >
                {selectedPlans.size} plan{selectedPlans.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2" role="group" aria-label="Bulk actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    selectedPlans.forEach((planId: string) => {
                      handleToggleStatus(planId)
                    })
                    setSelectedPlans(new Set())
                    announceToScreenReader(`Status toggled for ${selectedPlans.size} plans`)
                  }}
                  aria-label={`Toggle status for ${selectedPlans.size} selected plans`}
                >
                  Toggle Status
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${selectedPlans.size} plan(s)?`)) {
                      selectedPlans.forEach((planId: string) => handleDeletePlan(planId))
                      setSelectedPlans(new Set())
                    }
                  }}
                  aria-label={`Delete ${selectedPlans.size} selected plans`}
                >
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Comparison */}
      {!adminMode && plans.length > 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Plan Comparison</h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <caption className="sr-only">
                  Comparison of subscription plan features and pricing across {plans.filter((p: any) => p.active).length} available plans
                </caption>
                <thead>
                  <tr className="border-b">
                    <th 
                      className="text-left py-2"
                      scope="col"
                      id="feature-header"
                    >
                      Feature
                    </th>
                    {plans.filter((p: any) => p.active)?.filter(Boolean)?.map((plan: any) => (
                      <th 
                        key={plan.id} 
                        className="text-center py-2 min-w-[120px]"
                        scope="col"
                        id={`plan-${plan.id}-header`}
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <th 
                      className="py-2 font-medium text-left"
                      scope="row"
                      headers="feature-header"
                    >
                      Price
                    </th>
                    {plans.filter((p: any) => p.active)?.filter(Boolean)?.map((plan: any) => (
                      <td 
                        key={plan.id} 
                        className="text-center py-2"
                        headers={`feature-header plan-${plan.id}-header`}
                      >
                        {formatPrice(plan.price, plan.currency, plan.interval)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <th 
                      className="py-2 font-medium text-left"
                      scope="row"
                      headers="feature-header"
                    >
                      Tokens
                    </th>
                    {plans.filter((p: any) => p.active)?.filter(Boolean)?.map((plan: any) => (
                      <td 
                        key={plan.id} 
                        className="text-center py-2"
                        headers={`feature-header plan-${plan.id}-header`}
                      >
                        {formatNumber(plan.limits.tokens)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <th 
                      className="py-2 font-medium text-left"
                      scope="row"
                      headers="feature-header"
                    >
                      Users
                    </th>
                    {plans.filter((p: any) => p.active)?.filter(Boolean)?.map((plan: any) => (
                      <td 
                        key={plan.id} 
                        className="text-center py-2"
                        headers={`feature-header plan-${plan.id}-header`}
                      >
                        {formatNumber(plan.limits.users)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <th 
                      className="py-2 font-medium text-left"
                      scope="row"
                      headers="feature-header"
                    >
                      API Calls
                    </th>
                    {plans.filter((p: any) => p.active)?.filter(Boolean)?.map((plan: any) => (
                      <td 
                        key={plan.id} 
                        className="text-center py-2"
                        headers={`feature-header plan-${plan.id}-header`}
                      >
                        {formatNumber(plan.limits.apiCalls)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <th 
                      className="py-2 font-medium text-left"
                      scope="row"
                      headers="feature-header"
                    >
                      Storage
                    </th>
                    {plans.filter((p: any) => p.active)?.filter(Boolean)?.map((plan: any) => (
                      <td 
                        key={plan.id} 
                        className="text-center py-2"
                        headers={`feature-header plan-${plan.id}-header`}
                      >
                        {formatNumber(plan.limits.storage)}GB
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default PlanManager
