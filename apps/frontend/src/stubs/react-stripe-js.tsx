// Minimal stub for '@stripe/react-stripe-js'
import React, { createContext, useContext } from 'react'

const StripeCtx = createContext<any>(null)
const Elements: React.FC<{ stripe: any; children: any }> = ({ children, stripe }) => (
  <StripeCtx.Provider value={{ stripe, elements: { getElement: () => ({}) } }}>{children}</StripeCtx.Provider>
)

const CardElement: React.FC<any> = (props) => <div {...props} />

export function useStripe() {
  const ctx = useContext(StripeCtx)
  return ctx?.stripe
}

export function useElements() {
  const ctx = useContext(StripeCtx)
  return ctx?.elements
}

export { Elements, CardElement }

