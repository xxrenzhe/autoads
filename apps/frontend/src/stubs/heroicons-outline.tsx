// Minimal stubs for '@heroicons/react/24/outline'
import React from 'react'
const makeIcon = (name: string) => {
  const Icon = (props: any) => <span aria-label={name} {...props} />
  Icon.displayName = name
  return Icon
}
export const CreditCardIcon = makeIcon('CreditCardIcon')
export const LockClosedIcon = makeIcon('LockClosedIcon')
export const ExclamationCircleIcon = makeIcon('ExclamationCircleIcon')
export default {}
