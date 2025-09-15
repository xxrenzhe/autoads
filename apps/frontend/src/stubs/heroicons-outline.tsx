// Minimal stubs for '@heroicons/react/24/outline'
import React from 'react'
const makeIcon = (name: string) => {
  const Icon = (props: any) => <span aria-label={name} {...props} />
  Icon.displayName = name
  return Icon
}

// Commonly used outline icons in the app
export const ArrowRightIcon = makeIcon('ArrowRightIcon')
export const ArrowLeftIcon = makeIcon('ArrowLeftIcon')
export const ArrowUpIcon = makeIcon('ArrowUpIcon')
export const ArrowDownIcon = makeIcon('ArrowDownIcon')

export const CheckIcon = makeIcon('CheckIcon')
export const CheckCircleIcon = makeIcon('CheckCircleIcon')
export const XCircleIcon = makeIcon('XCircleIcon')
export const ExclamationTriangleIcon = makeIcon('ExclamationTriangleIcon')
export const ExclamationCircleIcon = makeIcon('ExclamationCircleIcon')

export const ShieldCheckIcon = makeIcon('ShieldCheckIcon')
export const ChartBarIcon = makeIcon('ChartBarIcon')
export const ChatBubbleLeftRightIcon = makeIcon('ChatBubbleLeftRightIcon')

export const CalendarIcon = makeIcon('CalendarIcon')
export const CreditCardIcon = makeIcon('CreditCardIcon')
export const CurrencyDollarIcon = makeIcon('CurrencyDollarIcon')
export const DocumentTextIcon = makeIcon('DocumentTextIcon')
export const CogIcon = makeIcon('CogIcon')
export const LockClosedIcon = makeIcon('LockClosedIcon')

export const ChevronDownIcon = makeIcon('ChevronDownIcon')
export const ChevronUpIcon = makeIcon('ChevronUpIcon')
export const ChevronUpDownIcon = makeIcon('ChevronUpDownIcon')
export const ChevronRightIcon = makeIcon('ChevronRightIcon')

export default {}
