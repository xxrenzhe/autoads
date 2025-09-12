'use client'

import { withAuth } from '@/components/auth/withAuth'

function APIManagementPage() {
  return (
    <div>
      <h1>API Management</h1>
      <p>This page is temporarily disabled due to missing dependencies.</p>
    </div>
  )
}

export default withAuth(APIManagementPage, {
  requiredRole: 'admin',
  redirectTo: '/admin/login'
})