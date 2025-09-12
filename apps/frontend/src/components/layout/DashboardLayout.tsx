'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import MainNavigation from '@/components/navigation/MainNavigation'
import SidebarNavigation from '@/components/navigation/SidebarNavigation'
import Breadcrumbs, { BreadcrumbItem } from '@/components/navigation/Breadcrumbs'
import GlobalSearch from '@/components/search/GlobalSearch'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  type?: 'user' | 'admin'
  breadcrumbs?: BreadcrumbItem[]
  title?: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export default function DashboardLayout({
  children,
  type = 'user',
  breadcrumbs,
  title,
  description,
  actions,
  className
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session } = useSession()

  // Determine if user has admin access
  const hasAdminAccess = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const actualType = type === 'admin' && hasAdminAccess ? 'admin' : 'user'

  return (
    <div className="min-h-screen bg-background">
      {/* Main Navigation */}
      <MainNavigation />

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <SidebarNavigation type={actualType} />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden fixed top-16 left-4 z-40"
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SidebarNavigation type={actualType} />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Content Header */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center gap-4 px-4 lg:px-8">
              {/* Mobile menu space */}
              <div className="w-8 lg:hidden" />

              {/* Breadcrumbs */}
              <div className="flex-1">
                <Breadcrumbs items={breadcrumbs} />
              </div>

              {/* Search */}
              <div className="hidden md:block">
                <GlobalSearch />
              </div>

              {/* Actions */}
              {actions && (
                <div className="flex items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          </div>

          {/* Page Header */}
          {(title || description) && (
            <div className="border-b">
              <div className="container px-4 lg:px-8 py-6">
                <div className="flex items-center justify-between">
                  <div>
                    {title && (
                      <h1 className="text-3xl font-bold tracking-tight">
                        {title}
                      </h1>
                    )}
                    {description && (
                      <p className="text-muted-foreground mt-2">
                        {description}
                      </p>
                    )}
                  </div>
                  {actions && (
                    <div className="flex items-center gap-2">
                      {actions}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Page Content */}
          <main className={cn("flex-1 container px-4 lg:px-8 py-6", className)}>
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t">
            <div className="container px-4 lg:px-8 py-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  © 2024 AutoAds. All rights reserved.
                </div>
                <div className="flex items-center gap-4">
                  <a href="/help" className="hover:text-foreground transition-colors">
                    Help
                  </a>
                  <a href="/privacy" className="hover:text-foreground transition-colors">
                    Privacy
                  </a>
                  <a href="/terms" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}

// Specialized layouts for different dashboard types
export function UserDashboardLayout(props: Omit<DashboardLayoutProps, 'type'>) {
  return <DashboardLayout {...props} type="user" />
}

export function AdminDashboardLayout(props: Omit<DashboardLayoutProps, 'type'>) {
  return <DashboardLayout {...props} type="admin" />
}