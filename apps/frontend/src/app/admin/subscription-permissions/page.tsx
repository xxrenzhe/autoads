'use client'

import { withAuth } from '@/components/auth/withAuth'

function SubscriptionPermissionsManagementPage() {
  return (
    <div>
      <h1>Subscription Permissions</h1>
      <p>This page is temporarily disabled due to missing dependencies.</p>
    </div>
  )
}

export default withAuth(SubscriptionPermissionsManagementPage, {
  requiredRole: 'admin',
  redirectTo: '/admin/login'
})