'use client'

import { withAuth } from '@/components/auth/withAuth'
import APIManagementDashboard from '../../../admin/components/api/APIManagementDashboard'

function APIManagementPage() {
  return <APIManagementDashboard />
}

export default withAuth(APIManagementPage, {
  requiredRole: 'admin',
  redirectTo: '/admin/login'
})