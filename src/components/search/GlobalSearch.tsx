'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  User, 
  Settings, 
  DollarSign, 
  BarChart3,
  Shield,
  Activity,
  FileText,
  Home,
  CreditCard
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  title: string
  description?: string
  href: string
  category: 'navigation' | 'admin' | 'user' | 'feature' | 'help'
  icon?: React.ComponentType<{ className?: string }>
  badge?: string
  requiresAuth?: boolean
  requiresRole?: string[]
}

const searchableItems: SearchResult[] = [
  // Navigation
  {
    id: 'home',
    title: 'Home',
    description: 'Return to homepage',
    href: '/',
    category: 'navigation',
    icon: Home
  },
  {
    id: 'pricing',
    title: 'Pricing',
    description: 'View pricing plans and subscription options',
    href: '/pricing',
    category: 'navigation',
    icon: DollarSign
  },
  {
    id: 'features',
    title: 'Features',
    description: 'Explore platform features',
    href: '/features',
    category: 'navigation'
  },

  // User Dashboard
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Your personal dashboard',
    href: '/dashboard',
    category: 'user',
    icon: BarChart3,
    requiresAuth: true
  },
  {
    id: 'token-balance',
    title: 'Token Balance',
    description: 'Manage your token balance and top-up',
    href: '/dashboard/balance',
    category: 'user',
    icon: CreditCard,
    requiresAuth: true
  },
  {
    id: 'token-usage',
    title: 'Token Usage',
    description: 'View token consumption analytics',
    href: '/dashboard/tokens',
    category: 'user',
    icon: BarChart3,
    requiresAuth: true
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Account and application settings',
    href: '/settings',
    category: 'user',
    icon: Settings,
    requiresAuth: true
  },

  // Features
  {
    id: 'siterank',
    title: 'SiteRank',
    description: 'Website ranking analysis',
    href: '/features/siterank',
    category: 'feature',
    requiresAuth: true
  },
  {
    id: 'batchopen',
    title: 'BatchOpen',
    description: 'Batch URL opening with proxy rotation',
    href: '/features/batchopen',
    category: 'feature',
    requiresAuth: true
  },
  {
    id: 'adscenter',
    title: 'ChangeLink',
    description: 'Google Ads automation management',
    href: '/features/adscenter',
    category: 'feature',
    requiresAuth: true
  },

  // Admin
  {
    id: 'admin-panel',
    title: 'Admin Panel',
    description: 'System administration dashboard',
    href: '/admin',
    category: 'admin',
    icon: Shield,
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    id: 'user-management',
    title: 'User Management',
    description: 'Manage users and permissions',
    href: '/admin/users',
    category: 'admin',
    icon: User,
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    id: 'security-dashboard',
    title: 'Security Dashboard',
    description: 'Monitor security threats and audit logs',
    href: '/admin/security',
    category: 'admin',
    icon: Shield,
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    id: 'system-monitoring',
    title: 'System Monitoring',
    description: 'Monitor system health and performance',
    href: '/admin/monitoring',
    category: 'admin',
    icon: Activity,
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    id: 'token-config',
    title: 'Token Configuration',
    description: 'Configure token costs and pricing',
    href: '/admin/tokens',
    category: 'admin',
    icon: Settings,
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    id: 'token-analytics',
    title: 'Token Analytics',
    description: 'View system-wide token analytics',
    href: '/admin/tokens/analytics',
    category: 'admin',
    icon: BarChart3,
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },

  // Help & Documentation
  {
    id: 'help',
    title: 'Help & Support',
    description: 'Get help and support',
    href: '/help',
    category: 'help',
    icon: FileText
  },
  {
    id: 'api-docs',
    title: 'API Documentation',
    description: 'API reference and documentation',
    href: '/docs/api',
    category: 'help',
    icon: FileText
  }
]

interface GlobalSearchProps {
  trigger?: React.ReactNode
}

export default function GlobalSearch({ trigger }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: session } = useSession()
  const router = useRouter()

  // Filter items based on user permissions
  const filteredItems = searchableItems.filter(item => {
    if (item.requiresAuth && !session) return false
    if (item.requiresRole && (!session?.user?.role || !item.requiresRole.includes(session.user.role))) return false
    return true
  })

  // Filter items based on search query
  const searchResults = query.length > 0 
    ? filteredItems.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : filteredItems

  // Group results by category
  const groupedResults = searchResults.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const handleSelect = useCallback((href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }, [router])

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const categoryLabels = {
    navigation: 'Navigation',
    user: 'Dashboard',
    feature: 'Features',
    admin: 'Administration',
    help: 'Help & Support'
  }

  const categoryOrder = ['navigation', 'user', 'feature', 'admin', 'help']

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>
          {trigger}
        </div>
      ) : (
        <Button
          variant="outline"
          className={cn(
            "relative h-8 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
          )}
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4 mr-2" />
          <span className="hidden lg:inline-flex">Search...</span>
          <span className="inline-flex lg:hidden">Search</span>
          <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search for pages, features, and more..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {categoryOrder.map((category) => {
            const items = groupedResults[category]
            if (!items || items.length === 0) return null

            return (
              <React.Fragment key={category}>
                <CommandGroup heading={categoryLabels[category as keyof typeof categoryLabels]}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.title} ${item.description}`}
                      onSelect={() => handleSelect(item.href)}
                      className="flex items-center gap-2"
                    >
                      {item.icon && <item.icon className="h-4 w-4" />}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span>{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {category !== categoryOrder[categoryOrder.length - 1] && <CommandSeparator />}
              </React.Fragment>
            )
          })}
        </CommandList>
      </CommandDialog>
    </>
  )
}