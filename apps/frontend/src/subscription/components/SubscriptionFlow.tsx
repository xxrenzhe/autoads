'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CreditCard,
  User,
  Shield,
  Zap
} from 'lucide-react'
import { PricingPage, PricingPlan } from './PricingPage'
import { PaymentProcessor } from './PaymentProcessor'
import { useRouter } from 'next/navigation'

export interface SubscriptionFlowProps {
  userId?: string
  currentPlan?: string
  onComplete?: (subscriptionId: string) => void
  onCancel?: () => void
  className?: string
}

type FlowStep = 'plan-selection' | 'payment' | 'confirmation'

export function SubscriptionFlow({ 
  userId, 
  currentPlan, 
  onComplete, 
  onCancel,
  className 
}: .*Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<FlowStep>('plan-selection')
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)

  const steps = [
    { id: 'plan-selection', title: 'Choose Plan', icon: Zap },
    { id: 'payment', title: 'Payment', icon: CreditCard },
    { id: 'confirmation', title: 'Confirmation', icon: CheckCircle }
  ]

  const handlePlanSelect = (planId: string, billing: 'monthly' | 'yearly') => {
    // This would typically fetch the plan details
    // For now, we'll create a mock plan object
    const mockPlan: PricingPlan = {
      id: planId,
      name: planId.charAt(0).toUpperCase() + planId.slice(1),
      description: `${planId} plan with all features`,
      price: {
        monthly: planId === 'free' ? 0 : planId === 'pro' ? 2900 : 9900,
        yearly: planId === 'free' ? 0 : planId === 'pro' ? 29000 : 99000,
        currency: 'USD'
      },
      features: [
        { name: 'Basic features', included: true },
        { name: 'Advanced analytics', included: planId !== 'free' },
        { name: 'Priority support', included: planId === 'business' }
      ],
      popular: planId === 'pro',
      buttonText: 'Choose Plan',
      buttonVariant: 'default'
    }

    setSelectedPlan(mockPlan)
    setBillingCycle(billing)
    
    if (planId === 'free') => {
      // Handle free plan signup
      handleFreeSignup()
    } else {
      setCurrentStep('payment')
    }
  }

  const handleFreeSignup = async () => {
    try {
      const response = await fetch('/api/subscription/free', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId: 'free' }),
      })

      const result = await response.json()

      if (result.success) => {
        setSubscriptionId(result.data.subscriptionId)
        setCurrentStep('confirmation')
      }
    } catch (error) {
      console.error('Failed to signup for free plan:', error)
    }
  }

  const handlePaymentSuccess = (subscriptionId: string) => {
    setSubscriptionId(subscriptionId)
    setCurrentStep('confirmation')
  }

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error)
    // Could show error state or go back to plan selection
  }

  const handleComplete = () => {
    if (subscriptionId) => {
      onComplete?.(subscriptionId)
    }
    router.push('/dashboard')
  }

  const handleBack = () => {
    if (currentStep === 'payment') => {
      setCurrentStep('plan-selection')
    } else if (currentStep === 'confirmation') => {
      setCurrentStep('payment')
    }
  }

  const getStepIndex = (step: FlowStep) => {
    return steps.findIndex(s => s.id === step)
  }

  const currentStepIndex = getStepIndex(currentStep)

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-8">
          {steps.map((step, index: any) => {
            const StepIcon = step.icon
            const isActive = index === currentStepIndex
            const isCompleted = index < currentStepIndex
            const isAccessible = index <= currentStepIndex

            return (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center space-x-3 ${
                  isAccessible ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isCompleted 
                      ? 'bg-green-500 border-green-500 text-white'
                      : isActive 
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`font-medium ${
                    isAccessible ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
                
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    index < currentStepIndex ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 'plan-selection' && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Choose Your Plan
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Select the perfect plan for your needs. You can upgrade or downgrade at any time.
              </p>
            </div>
            
            <PricingPage
              userId={userId}
              currentPlan={currentPlan}
              onSelectPlan={handlePlanSelect}
            />
          </div>
        )}

        {currentStep === 'payment' && selectedPlan && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Complete Your Payment
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                You're subscribing to the {selectedPlan.name} plan
              </p>
            </div>

            {/* Plan Summary */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedPlan.name} Plan
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {selectedPlan.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: selectedPlan.price.currency
                      }).format(
                        (billingCycle === 'monthly' 
                          ? selectedPlan.price.monthly 
                          : selectedPlan.price.yearly
                        ) / 100
                      )}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      per {billingCycle === 'monthly' ? 'month' : 'year'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <PaymentProcessor
              planId={selectedPlan.id}
              planName={selectedPlan.name}
              planPrice={billingCycle === 'monthly' 
                ? selectedPlan.price.monthly 
                : selectedPlan.price.yearly
              }
              currency={selectedPlan.price.currency}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              onCancel={handleBack}
            />
          </div>
        )}

        {currentStep === 'confirmation' && selectedPlan && (
          <div>
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
                
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Welcome to {selectedPlan.name}!
                </h1>
                
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                  Your subscription has been activated successfully.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                      <User className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Account Active
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Your account is now active
                      </p>
                    </div>
                    
                    <div>
                      <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Full Access
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Access to all {selectedPlan.name} features
                      </p>
                    </div>
                    
                    <div>
                      <CreditCard className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        Billing Active
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} billing
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    What's Next?
                  </h3>
                  
                  <div className="text-left space-y-2">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Explore your dashboard and new features
                      </span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Check your email for subscription confirmation
                      </span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Manage your subscription in account settings
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-4 mt-8">
                  <Button onClick={handleComplete} size="lg">
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        {currentStep !== 'confirmation' && (
          <div className="flex items-center justify-between pt-6">
            <Button
              variant="outline"
              onClick={currentStep === 'plan-selection' ? onCancel : handleBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStep === 'plan-selection' ? 'Cancel' : 'Back'}
            </Button>

            <div className="text-sm text-gray-500">
              Step {currentStepIndex + 1} of {steps.length}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SubscriptionFlow