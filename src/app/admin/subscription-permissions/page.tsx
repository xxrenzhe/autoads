'use client'

import { withAuth } from '@/components/auth/withAuth'
import SubscriptionPermissionsPage from '../../../admin/components/subscription/SubscriptionPermissionsPage'

function SubscriptionPermissionsManagementPage() {
  return <SubscriptionPermissionsPage />
}

export default withAuth(SubscriptionPermissionsManagementPage, {
  requiredRole: 'admin',
  redirectTo: '/admin/login'
})