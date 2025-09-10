import { Metadata } from 'next'
import PricingPage from '@/components/pricing/PricingPage'

export const metadata: Metadata = {
  title: 'Pricing - AutoAds',
  description: 'Choose the perfect plan for your needs. Flexible pricing with powerful features.',
}

export default function Pricing() {
  return <PricingPage />
}