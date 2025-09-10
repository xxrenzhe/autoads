'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import GlobalSearch from '@/components/search/GlobalSearch'
import { 
  DollarSign, 
  Settings, 
  User, 
  LogOut, 
  Shield,
  BarChart3,
  Bell,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationItem {
  title: string
  href: string
  description?: string
  requiresAuth?: boolean
  requiresRole?: string[]
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Pricing',
    href: '/pricing',
    description: 'View pricing plans'
  },
  {
    title: 'Dashboard',
    href: '/dashboard',
    description: 'Access your dashboard',
    requiresAuth: true
  }
]

const adminNavigationItems: NavigationItem[] = [
  {
    title: 'Admin Panel',
    href: '/admin',
    description: 'System administration',
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    title: 'Users',
    href: '/admin/users',
    description: 'Manage users',
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    title: 'Security',
    href: '/admin/security',
    description: 'Security monitoring',
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    title: 'Monitoring',
    href: '/admin/monitoring',
    description: 'System monitoring',
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  },
  {
    title: 'Tokens',
    href: '/admin/tokens',
    description: 'Token management',
    requiresRole: ['ADMIN', 'SUPER_ADMIN']
  }
]

export function NavigationLinks() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const hasRole = (requiredRoles?: string[]) => {
    if (!requiredRoles || !session?.user?.role) return false
    return requiredRoles.includes(session.user.role)
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  const filteredNavigationItems = navigationItems.filter(item => {
    if (item.requiresAuth && !session) return false
    if (item.requiresRole && !hasRole(item.requiresRole)) return false
    return true
  })

  const filteredAdminItems = adminNavigationItems.filter(item => {
    if (item.requiresRole && !hasRole(item.requiresRole)) return false
    return true
  })

  return (
    <NavigationMenu className="hidden md:flex">
      <NavigationMenuList>
        {filteredNavigationItems.map((item) => (
          <NavigationMenuItem key={item.href}>
            <Link href={item.href} legacyBehavior passHref>
              <NavigationMenuLink
                className={cn(
                  "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
                  isActive(item.href) && "bg-accent text-accent-foreground"
                )}
              >
                {item.title}
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        ))}

        {/* Admin Menu */}
        {filteredAdminItems.length > 0 && (
          <NavigationMenuItem>
            <NavigationMenuTrigger className={cn(
              isActive('/admin') && "bg-accent text-accent-foreground"
            )}>
              <Shield className="mr-2 h-4 w-4" />
              Admin
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                {filteredAdminItems.map((item) => (
                  <li key={item.href}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          isActive(item.href) && "bg-accent text-accent-foreground"
                        )}
                      >
                        <div className="text-sm font-medium leading-none">
                          {item.title}
                        </div>
                        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                          {item.description}
                        </p>
                      </Link>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        )}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export function UserActions() {
  const { data: session } = useSession()

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="hidden md:block">
        <GlobalSearch 
          trigger={
            <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>
          }
        />
      </div>

      {/* Notifications */}
      {session && (
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
          <Bell className="h-4 w-4" />
          <span className="sr-only">Notifications</span>
        </Button>
      )}

      {/* User Menu */}
      {session ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.user?.image || ''} alt={session.user?.name || ''} />
                <AvatarFallback>
                  {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {session.user?.name}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard">
                <User className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/balance">
                <DollarSign className="mr-2 h-4 w-4" />
                Token Balance
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/tokens">
                <BarChart3 className="mr-2 h-4 w-4" />
                Token Usage
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/api/auth/signout">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth/signin">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/auth/signin">Get Started</Link>
          </Button>
        </div>
      )}
    </div>
  )
}