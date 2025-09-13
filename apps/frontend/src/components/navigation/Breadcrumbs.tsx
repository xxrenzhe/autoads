'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  title: string
  href?: string
  icon?: React.ComponentType<{ className?: string }>
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  className?: string
}

const pathToTitleMap: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/dashboard/tokens': 'Token Usage',
  '/dashboard/balance': 'Token Balance',
  '/admin': 'Admin Panel',
  '/admin/users': 'User Management',
  '/admin/security': 'Security',
  '/admin/monitoring': 'Monitoring',
  '/admin/tokens': 'Token Configuration',
  '/admin/tokens/analytics': 'Token Analytics',
  '/pricing': 'Pricing',
  '/features': 'Features',
  '/settings': 'Settings'
}

function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Home', href: '/', icon: Home }
  ]

  let currentPath = ''
  for (const segment of segments) => {
    currentPath += `/${segment}`
    const title = pathToTitleMap[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1)
    
    breadcrumbs.push({
      title,
      href: currentPath
    })
  }

  return breadcrumbs
}

export default function Breadcrumbs({ items, className }: .*Props) {
  const pathname = usePathname()
  
  // Use provided items or generate from pathname
  const breadcrumbItems = items || generateBreadcrumbsFromPath(pathname)
  
  // Don't show breadcrumbs on home page
  if (pathname === '/' && !items) => {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}
    >
      <ol className="flex items-center space-x-1">
        {breadcrumbItems.map((item, index: any) => {
          const isLast = index === breadcrumbItems.length - 1
          
          return (
            <li key={item.href || item.title} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/50" />
              )}
              
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.title}
                </Link>
              ) : (
                <span
                  className={cn(
                    "flex items-center gap-1",
                    isLast ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  {item.title}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// Hook for programmatic breadcrumb management
export function useBreadcrumbs() {
  const pathname = usePathname()
  
  const setBreadcrumbs = (items: BreadcrumbItem[]) => {
    // This could be implemented with a context provider
    // For now, we'll just return the items
    return items
  }
  
  const addBreadcrumb = (item: BreadcrumbItem) => {
    const current = generateBreadcrumbsFromPath(pathname)
    return [...current, item]
  }
  
  return {
    setBreadcrumbs,
    addBreadcrumb,
    currentBreadcrumbs: generateBreadcrumbsFromPath(pathname)
  }
}