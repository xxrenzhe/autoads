// Minimal stubs for '@heroicons/react/24/solid'
import React from 'react'
const makeIcon = (name: string) => {
  const Icon = (props: any) => <span aria-label={name} {...props} />
  Icon.displayName = name
  return Icon
}
export const CheckIcon = makeIcon('CheckIcon')
export const XMarkIcon = makeIcon('XMarkIcon')
export default {}
