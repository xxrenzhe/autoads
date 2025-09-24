'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  ChevronLeft,
  ChevronRight,
  Home,
  BarChart3,
  CreditCard,
  Settings,
  User,
  Shield,
  Activity,
  Users,
  Database,
  Bell,
  FileText,
  KeySquare as KeyIcon,
  Zap,
  TrendingUp,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  description?: string
  children?: NavigationItem[]
  requiresRole?: string[]
}

const userNavigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    description: 'Overview and analytics'
  },
  {
    title: 'Features',
    href: '/features',
    icon: Zap,
    description: 'Platform features',
    children: [
      {
        title: 'SiteRank',
        href: '/features/siterank',
        icon: TrendingUp,
        description: 'Website ranking analysis'
      },
      {
        title: 'BatchOpen',
        href: '/features/batchopen',
        icon: Globe,
        description: 'Batch URL operations'
      },
      {
        title: 'AdsCenter',
        href: '/features/adscenter',
        icon: FileText,
        description: 'Link management'
      }
    ]
  },
  {
    title: 'Token Balance',
    href: '/dashboard/balance',
    icon: CreditCard,
    description: 'Manage tokens'
  },
  {
    title: 'Token Usage',
    href: '/dashboard/tokens',
    icon: BarChart3,
    description: 'Usage analytics'
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Account settings'
  }
]

const adminNavigationItems: NavigationItem[] = [
  {
    title: 'Admin Dashboard',
    href: '/ops/console/panel',
    icon: Shield,
    description: 'Admin overview'
  },
  {
    title: 'User Management',
    href: '/ops/console/users',
    icon: Users,
    description: 'Manage users'
  },
  {
    title: 'Security',
    href: '/ops/console/security',
    icon: Shield,
    description: 'Security monitoring'
  },
  {
    title: 'System Monitoring',
    href: '/ops/console/monitoring',
    icon: Activity,
    description: 'System health'
  },
  {
    title: 'System Config',
    href: '/admin/system',
    icon: Settings,
    description: 'Hot config updates',
    children: [
      {
        title: 'AutoClick 配置',
        href: '/admin/system/autoclick',
        icon: Settings,
        description: 'Proxy/方差热更新'
      }
    ]
  },
  {
    title: 'Token Management',
    href: '/ops/console/tokens',
    icon: Database,
    description: 'Token configuration',
    children: [
      {
        title: 'Configuration',
        href: '/ops/console/tokens',
        icon: Settings,
        description: 'Token settings'
      },
      {
        title: 'Analytics',
        href: '/ops/console/tokens/analytics',
        icon: BarChart3,
        description: 'Token analytics'
      }
    ]
  },
  {
    title: 'AutoClick 管理',
    href: '/admin/autoclick',
    icon: Globe,
    description: 'AutoClick 执行管理',
    children: [
      {
        title: '问题 URL',
        href: '/admin/autoclick/problem-urls',
        icon: Globe,
        description: '失败URL与切换标记'
      },
      {
        title: '历史统计',
        href: '/admin/autoclick/history',
        icon: TrendingUp,
        description: '最近N天汇总'
      }
    ]
  },
  {
    title: 'AdsCenter 管理',
    href: '/admin/adscenter',
    icon: FileText,
    description: 'AdsCenter 凭据与指标',
    children: [
      {
        title: '凭据总览',
        href: '/admin/adscenter/credentials',
        icon: KeyIcon,
        description: 'OAuth 凭据列表与筛选'
      },
      {
        title: 'OAuth 管理',
        href: '/admin/adscenter/oauth',
        icon: Shield,
        description: '授权链接与回调'
      },
      {
        title: '指标回填/导出',
        href: '/admin/adscenter/metrics',
        icon: Database,
        description: '回填触发与CSV导出'
      }
    ]
  },
  {
    title: 'Notifications',
    href: '/ops/console/notifications',
    icon: Bell,
    description: 'Notification management'
  }
]

interface SidebarNavigationProps {
  type: 'user' | 'admin'
  className?: string
}

export default function SidebarNavigation({ type, className }: SidebarNavigationProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const pathname = usePathname() || ''
  const { data: session } = useSession()

  const navigationItems = type === 'admin' ? adminNavigationItems : userNavigationItems

  const hasRole = (requiredRoles?: string[]) => {
    if (!requiredRoles || !session?.user?.role) return true
    return requiredRoles.includes(session.user.role)
  }

  const isActive = (href: string) => {
    if (href === '/dashboard' || href === '/admin') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) 
        ? prev.filter((item: any) => item !== href)
        : [...prev, href]
    )
  }

  const filteredItems = navigationItems.filter((item: any) => hasRole(item.requiresRole))

  return (
    <div className={cn(
      "flex flex-col border-r bg-background transition-all duration-300",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        {!collapsed && (
          <div>
            <h2 className="text-lg font-semibold">
              {type === 'admin' ? 'Admin Panel' : 'Dashboard'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {session?.user?.name || session?.user?.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 p-0"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          {filteredItems.map((item) => (
            <div key={item.href}>
              <div className="relative">
                <Link
                  href={item.children ? '#' : item.href}
                  onClick={(e) => {
                    if (item.children) {
                      e.preventDefault()
                      toggleExpanded(item.href)
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive(item.href) && "bg-accent text-accent-foreground",
                    collapsed && "justify-center"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.title}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                      {item.children && (
                        <ChevronRight 
                          className={cn(
                            "h-4 w-4 transition-transform",
                            expandedItems.includes(item.href) && "rotate-90"
                          )}
                        />
                      )}
                    </>
                  )}
                </Link>

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full top-0 ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item.title}
                    {item.description && (
                      <div className="text-muted-foreground">{item.description}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Children */}
              {item.children && !collapsed && expandedItems.includes(item.href) && (
                <div className="ml-6 mt-2 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        isActive(child.href) && "bg-accent text-accent-foreground"
                      )}
                    >
                      <child.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1">{child.title}</span>
                      {child.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {child.badge}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session?.user?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session?.user?.role || 'USER'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for managing sidebar state
export function useSidebarNavigation() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return {
    collapsed,
    setCollapsed,
    mobileOpen,
    setMobileOpen,
    toggleCollapsed: () => setCollapsed(!collapsed),
    toggleMobileOpen: () => setMobileOpen(!mobileOpen)
  }
}
