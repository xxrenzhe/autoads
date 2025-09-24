import { Metadata } from 'next'
import { auth } from '@/lib/auth/v5-config'
import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
import TokenUsageAnalytics from '@/components/user/TokenUsageAnalytics'

export const metadata: Metadata = {
  title: 'Token Usage - Dashboard',
  description: 'View your token usage analytics and consumption patterns',
}


export default async function TokenUsagePage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-6">
      <TokenUsageAnalytics />
    </div>
  )
}
