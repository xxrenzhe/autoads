import { Metadata } from 'next'
import { auth } from '@/lib/auth/v5-config'
import { redirect } from 'next/navigation'
import TokenBalanceManager from '@/components/user/TokenBalanceManager'

export const metadata: Metadata = {
  title: 'Token Balance - Dashboard',
  description: 'Manage your token balance and top-up account',
}

export default async function TokenBalancePage() {
  const session = await auth()
  
  if (!session?.user) => {
    redirect('/auth/signin')
  }

  return (
    <div className="container mx-auto py-6">
      <TokenBalanceManager />
    </div>
  )
}