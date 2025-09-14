'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { 
  CreditCardIcon,
  LockClosedIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface Plan {
  id: string
  name: string
  price: number
  interval: 'month' | 'year'
  tokens: number
  features: string[]
  stripePriceId: string
}

interface PaymentFormProps {
  plan: Plan
  onSubmit: (paymentData: any) => Promise<void>
  loading: boolean
}

interface BillingDetails {
  name: string
  email: string
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
}

function PaymentFormContent({ plan, onSubmit, loading }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  
  const [billingDetails, setBillingDetails] = useState<BillingDetails>({
    name: '',
    email: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US'
    }
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cardError, setCardError] = useState<string | null>(null)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!billingDetails.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!billingDetails.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(billingDetails.email)) {
      newErrors.email = 'Email is invalid'
    }

    if (!billingDetails.address.line1.trim()) {
      newErrors.address_line1 = 'Address is required'
    }

    if (!billingDetails.address.city.trim()) {
      newErrors.city = 'City is required'
    }

    if (!billingDetails.address.state.trim()) {
      newErrors.state = 'State is required'
    }

    if (!billingDetails.address.postal_code.trim()) {
      newErrors.postal_code = 'Postal code is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || loading) {
      return
    }

    if (!validateForm()) {
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      return
    }

    // Create payment method
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: billingDetails.name,
        email: billingDetails.email,
        address: {
          line1: billingDetails.address.line1,
          line2: billingDetails.address.line2 || undefined,
          city: billingDetails.address.city,
          state: billingDetails.address.state,
          postal_code: billingDetails.address.postal_code,
          country: billingDetails.address.country,
        },
      },
    })

    if (error) {
      setCardError(error.message || 'An error occurred with your card')
      return
    }

    // Submit to parent component
    await onSubmit({
      paymentMethodId: paymentMethod.id,
      billingDetails
    })
  }

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1]
      setBillingDetails(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }))
    } else {
      setBillingDetails(prev => ({
        ...prev,
        [field]: value
      }))
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const cardElementOptions = {
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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Order Summary</h3>
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium">{plan.name}</div>
            <div className="text-sm text-gray-600">
              {plan.tokens.toLocaleString()} tokens per {plan.interval}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-lg">${plan.price}</div>
            <div className="text-sm text-gray-600">per {plan.interval}</div>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Billing Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              value={billingDetails.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={billingDetails.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="address_line1" className="block text-sm font-medium text-gray-700 mb-1">
            Address *
          </label>
          <input
            type="text"
            id="address_line1"
            value={billingDetails.address.line1}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('address.line1', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.address_line1 ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="123 Main Street"
          />
          {errors.address_line1 && (
            <p className="mt-1 text-sm text-red-600">{errors.address_line1}</p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="address_line2" className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 2 (Optional)
          </label>
          <input
            type="text"
            id="address_line2"
            value={billingDetails.address.line2 || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('address.line2', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Apartment, suite, etc."
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <input
              type="text"
              id="city"
              value={billingDetails.address.city}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('address.city', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.city ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="New York"
            />
            {errors.city && (
              <p className="mt-1 text-sm text-red-600">{errors.city}</p>
            )}
          </div>

          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
              State *
            </label>
            <input
              type="text"
              id="state"
              value={billingDetails.address.state}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('address.state', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.state ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="NY"
            />
            {errors.state && (
              <p className="mt-1 text-sm text-red-600">{errors.state}</p>
            )}
          </div>

          <div>
            <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-1">
              Postal Code *
            </label>
            <input
              type="text"
              id="postal_code"
              value={billingDetails.address.postal_code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('address.postal_code', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.postal_code ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="10001"
            />
            {errors.postal_code && (
              <p className="mt-1 text-sm text-red-600">{errors.postal_code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Payment Information
        </h3>
        
        <div className="border border-gray-300 rounded-md p-3">
          <CardElement
            options={cardElementOptions}
            onChange={(event) => {
              // Stripe types may not be available; keep loose typing
              // @ts-ignore - event type depends on Stripe SDK typing presence
              setCardError(event.error ? event.error.message : null)
            }}
          />
        </div>
        
        {cardError && (
          <div className="mt-2 flex items-center text-sm text-red-600">
            <ExclamationCircleIcon className="h-4 w-4 mr-1" />
            {cardError}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <LockClosedIcon className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium">Secure Payment</p>
            <p>Your payment information is encrypted and secure. We use Stripe to process payments.</p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing...
          </>
        ) : (
          <>
            <CreditCardIcon className="h-5 w-5 mr-2" />
            Subscribe for ${plan.price}/{plan.interval}
          </>
        )}
      </button>
    </form>
  )
}

export default function PaymentForm(props: PaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent {...props} />
    </Elements>
  )
}
