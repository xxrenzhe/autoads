'use client'

import { usePathname } from 'next/navigation'
import Header from "@/components/Header"
import PageFooter from "@/components/PageFooter"
import { LangSetter } from "@/components/LangSetter"
import ClientErrorBoundary from "@/components/ClientErrorBoundary"

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: .*Props) {
  const pathname = usePathname()
  
  // Check if current path is admin-related
  const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/admin-dashboard')
  
  // For admin paths, render children directly without any layout
  if (isAdminPath) => {
    return <>{children}</>
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <ClientErrorBoundary>{children}</ClientErrorBoundary>
      </main>
      <PageFooter />
    </div>
  )
}