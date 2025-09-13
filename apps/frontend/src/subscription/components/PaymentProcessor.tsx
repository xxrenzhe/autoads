'use client'
import React, { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CreditCard,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export interface PaymentProcessorProps {
  planId: string
  planName: string
  planPrice: number
  currency: string
  onSuccess?: (subscriptionId: string) => void
  onError?: (error: string) => void
  onCancel?: () => void
}

interface PaymentFormProps extends PaymentProcessorProps {
  clientSecret?: string
}

function PaymentForm({ 
  planId, 
  planName, 
  planPrice, 
  currency, 
  clientSecret,
  onSuccess, 
  onError, 
  onCancel 
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(price / 100)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setPaymentError(null)

    const cardElement = elements.getElement(CardElement)

    if (!cardElement) {
      setPaymentError('Card element not found')
      setIsProcessing(false)
      return
    }

    try {
      if (clientSecret) {
        // Confirm payment for subscription
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
          }
        })

        if (error) {
          setPaymentError(error.message || 'Payment failed')
          onError?.(error.message || 'Payment failed')
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
          setPaymentSuccess(true)
          onSuccess?.(paymentIntent.id)
        }
      } else {
        // Create subscription
        const response = await fetch('/api/subscription/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ planId }),
        })

        const result = await response.json()

        if (!result.success) {
          setPaymentError(result.error)
          onError?.(result.error)
          return
        }

        if (result.data.clientSecret) {
          const { error, paymentIntent } = await stripe.confirmCardPayment(result.data.clientSecret, {
            payment_method: {
              card: cardElement,
            }
          })

          if (error) {
            setPaymentError(error.message || 'Payment failed')
            onError?.(error.message || 'Payment failed')
          } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            setPaymentSuccess(true)
            onSuccess?.(result.data.subscription.id)
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setPaymentError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  if (paymentSuccess) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Payment Successful!
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your subscription to {planName} has been activated.
          </p>
          <Badge variant="success" className="mb-4">
            Subscription Active
          </Badge>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Complete Your Payment
        </CardTitle>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {planName}
          </span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatPrice(planPrice, currency)}
          </span>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card Element */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Card Information
            </label>
            <div className="p-3 border border-gray-300 rounded-md bg-white dark:bg-gray-800">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Error Message */}
          {paymentError && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              <span className="text-sm text-red-700">{paymentError}</span>
            </div>
          )}

          {/* Security Notice */}
          <div className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-md">
            <Lock className="h-4 w-4 text-gray-500 mr-2" />
            <span className="text-xs text-gray-600">
              Your payment information is secure and encrypted
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <Button
              type="submit"
              disabled={!stripe || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Pay {formatPrice(planPrice, currency)}
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>

          {/* Terms */}
          <p className="text-xs text-gray-500 text-center">
            By completing your payment, you agree to our Terms of Service and Privacy Policy.
            Your subscription will automatically renew unless cancelled.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

export function PaymentProcessor(props: PaymentProcessorProps) {
  const [clientSecret, setClientSecret] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Pre-create payment intent if needed
    const initializePayment = async () => {
      setIsLoading(true)
      try {
        // This could be used for one-time payments
        // For subscriptions, we'll create the payment intent in the form
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to initialize payment')
      } finally {
        setIsLoading(false)
      }
    }

    // Uncomment if you need to pre-initialize payment
    // initializePayment()
  }, [props.planId])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Initializing payment...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Payment Error
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <Button onClick={((: any): any) => setError(null)} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} clientSecret={clientSecret} />
    </Elements>
  )
}

export default PaymentProcessor