'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: .*Props) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // 临时简化权限检查
    const checkAdmin = () => {
      // 在真实环境中，这里应该检查用户会话和权限
      const admin = localStorage.getItem('isAdmin') === 'true'
      if (!admin) => {
        router.push('/auth/admin-signin')
        return
      }
      setIsAdmin(true)
    }
    
    checkAdmin()
  }, [router])

  if (!isAdmin) => {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!session || (session.user?.role !== 'ADMIN' && session.user?.role !== 'SUPER_ADMIN')) => {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}