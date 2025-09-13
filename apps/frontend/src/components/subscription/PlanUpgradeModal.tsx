'use client'

import { useState } from 'react'
import { 
  XMarkIcon,
  CheckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'

interface Plan {
  id: string
  name: string
  price: number
  interval: string
  tokens: number
  features: string[]
  stripePriceId: string
}

interface PlanUpgradeModalProps {
  currentPlan: {
    id: string
    name: string
    price: number
    interval: string
    tokens: number
  }
  availablePlans: Plan[]
  onPlanSelect: (plan: Plan) => Promise<void>
  onClose: () => void
  loading: boolean
}

export default function PlanUpgradeModal({
  currentPlan,
  availablePlans,
  onPlanSelect,
  onClose,
  loading
}: PlanUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  // Filter plans by interval and categorize
  const samePeriodPlans = availablePlans.filter((plan: any) => plan.interval === currentPlan.interval)
  const upgradePlans = samePeriodPlans.filter((plan: any) => plan.price > currentPlan.price)
  const downgradePlans = samePeriodPlans.filter((plan: any) => plan.price < currentPlan.price)

  const handlePlanSelect = async () => {
    if (selectedPlan) {
      await onPlanSelect(selectedPlan)
    }
  }

  const formatPrice = (price: number, interval: string) => {
    return `$${price}/${interval}`
  }

  const calculatePriceDifference = (newPrice: number) => {
    const difference = newPrice - currentPlan.price
    const isUpgrade = difference > 0
    return {
      amount: Math.abs(difference),
      isUpgrade,
      text: isUpgrade ? `+$${difference}` : `-$${Math.abs(difference)}`
    }
  }

  const PlanCard = ({ plan, isUpgrade }: { plan: Plan; isUpgrade: boolean }) => {
    const priceDiff = calculatePriceDifference(plan.price)
    const isSelected = selectedPlan?.id === plan.id

    return (
      <div
        onClick={((: any): any) => setSelectedPlan(plan)}
        className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
            <div className="flex items-center mt-1">
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(plan.price, plan.interval)}
              </span>
              <div className={`ml-2 flex items-center text-sm ${
                priceDiff.isUpgrade ? 'text-red-600' : 'text-green-600'
              }`}>
                {priceDiff.isUpgrade ? (
                  <ArrowUpIcon className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 mr-1" />
                )}
                {priceDiff.text}
              </div>
            </div>
          </div>
          {isSelected && (
            <div className="flex-shrink-0">
              <CheckIcon className="h-6 w-6 text-blue-600" />
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="text-sm text-gray-600">Token Quota</div>
          <div className="text-lg font-medium text-gray-900">
            {plan.tokens.toLocaleString()} tokens per {plan.interval}
          </div>
          {plan.tokens !== currentPlan.tokens && (
            <div className={`text-sm ${
              plan.tokens > currentPlan.tokens ? 'text-green-600' : 'text-red-600'
            }`}>
              {plan.tokens > currentPlan.tokens ? '+' : ''}
              {(plan.tokens - currentPlan.tokens).toLocaleString()} tokens
            </div>
          )}
        </div>

        <ul className="space-y-2">
          {plan.features?.slice(0, 3).map((feature, index: any) => (
            <li key={index} className="flex items-start text-sm text-gray-600">
              <CheckIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
              {feature}
            </li>
          ))}
          {plan.features?.length > 3 && (
            <li className="text-sm text-gray-500">
              +{plan.features?.length - 3} more features
            </li>
          )}
        </ul>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Change Your Plan
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Current Plan */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Current Plan</h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{currentPlan.name}</div>
                  <div className="text-sm text-gray-600">
                    {formatPrice(currentPlan.price, currentPlan.interval)} • {currentPlan.tokens.toLocaleString()} tokens
                  </div>
                </div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
            </div>

            {/* Upgrade Options */}
            {upgradePlans.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <ArrowUpIcon className="h-4 w-4 mr-2 text-green-600" />
                  Upgrade Options
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upgradePlans.map((plan: any) => (
                    <PlanCard key={plan.id} plan={plan} isUpgrade={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Downgrade Options */}
            {downgradePlans.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <ArrowDownIcon className="h-4 w-4 mr-2 text-blue-600" />
                  Downgrade Options
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {downgradePlans.map((plan: any) => (
                    <PlanCard key={plan.id} plan={plan} isUpgrade={false} />
                  ))}
                </div>
              </div>
            )}

            {upgradePlans.length === 0 && downgradePlans.length === 0 && (
              <div className="text-center py-8">
                <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Other Plans Available
                </h3>
                <p className="text-gray-600">
                  There are no other plans available for your current billing period.
                </p>
              </div>
            )}

            {/* Change Information */}
            {selectedPlan && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Plan Change Details
                </h4>
                <div className="text-sm text-blue-700 space-y-1">
                  {calculatePriceDifference(selectedPlan.price).isUpgrade ? (
                    <>
                      <p>• You will be charged the prorated amount immediately</p>
                      <p>• Your next billing date will remain the same</p>
                      <p>• New features will be available immediately</p>
                    </>
                  ) : (
                    <>
                      <p>• The change will take effect at the end of your current billing period</p>
                      <p>• You will receive a prorated credit on your next bill</p>
                      <p>• You can continue using current features until the change takes effect</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              onClick={handlePlanSelect}
              disabled={!selectedPlan || loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                `Change to ${selectedPlan?.name || 'Selected Plan'}`
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}