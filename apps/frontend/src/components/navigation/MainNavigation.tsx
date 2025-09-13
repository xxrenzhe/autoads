'use client'

import React, { useState, useEffect, useRef } from 'react'
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
import { 
  Home, 
  DollarSign, 
  Settings, 
  User, 
  LogOut, 
  Shield,
  BarChart3,
  Menu,
  X,
  Search,
  Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationItem {
  title: string
  href: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string
  requiresAuth?: boolean
  requiresRole?: string[]
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Home',
    href: '/',
    description: 'Return to homepage',
    icon: Home
  },
  {
    title: 'Features',
    href: '/features',
    description: 'Explore our features'
  },
  {
    title: 'Pricing',
    href: '/pricing',
    description: 'View pricing plans',
    icon: DollarSign
  },
  {
    title: 'Dashboard',
    href: '/dashboard',
    description: 'Access your dashboard',
    icon: BarChart3,
    requiresAuth: true
  }
]

const adminNavigationItems: NavigationItem[] = [
  {
    title: 'Admin Panel',
    href: '/admin',
    description: 'System administration',
    icon: Shield,
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

export default function MainNavigation() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)

  // Handle keyboard events for mobile menu
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && mobileMenuOpen) {
      setMobileMenuOpen(false)
      mobileMenuButtonRef.current?.focus()
    }
  }

  // Focus management for mobile menu
  useEffect(() => {
    if (mobileMenuOpen) {
      // Focus first link in mobile menu
      const firstLink = mobileMenuRef.current?.querySelector('a')
      firstLink?.focus()
    }
  }, [mobileMenuOpen])

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

  const filteredNavigationItems = navigationItems.filter((item: any) => {
    if (item.requiresAuth && !session) return false
    if (item.requiresRole && !hasRole(item.requiresRole)) return false
    return true
  })

  const filteredAdminItems = adminNavigationItems.filter((item: any) => {
    if (item.requiresRole && !hasRole(item.requiresRole)) return false
    return true
  })

  return (
    <>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      
      <header 
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        role="banner"
        aria-label="Main navigation"
        onKeyDown={handleKeyDown}
      >
        <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="h-6 w-6 bg-primary rounded" />
            <span className="hidden font-bold sm:inline-block">
              AutoAds
            </span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <Button
          ref={mobileMenuButtonRef}
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          onClick={((: any): any) => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-menu"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
          <span className="sr-only">{mobileMenuOpen ? "Close" : "Open"} Menu</span>
        </Button>

        {/* Desktop Navigation */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                {filteredNavigationItems.map((item: any) => (
                  <NavigationMenuItem key={item.href}>
                    <Link href={item.href} legacyBehavior passHref>
                      <NavigationMenuLink
                        className={cn(
                          "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
                          isActive(item.href) && "bg-accent text-accent-foreground"
                        )}
                        aria-current={isActive(item.href) ? "page" : undefined}
                      >
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        {item.title}
                        {item.badge && (
                          <Badge variant="secondary" className="ml-2">
                            {item.badge}
                          </Badge>
                        )}
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
                        {filteredAdminItems.map((item: any) => (
                          <li key={item.href}>
                            <NavigationMenuLink asChild>
                              <Link
                                href={item.href}
                                className={cn(
                                  "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                                  isActive(item.href) && "bg-accent text-accent-foreground"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {item.icon && <item.icon className="h-4 w-4" />}
                                  <div className="text-sm font-medium leading-none">
                                    {item.title}
                                  </div>
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
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 px-0"
              aria-label="Open search"
              type="button"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Search</span>
            </Button>

            {/* Notifications */}
            {session && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 px-0"
                aria-label="View notifications"
                type="button"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Notifications</span>
              </Button>
            )}

            {/* User Menu */}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-8 w-8 rounded-full"
                    aria-label={`User menu for ${session.user?.name || session.user?.email || 'user'}`}
                    type="button"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={session.user?.image || ''} 
                        alt={`${session.user?.name || session.user?.email || 'User'} profile picture`} 
                      />
                      <AvatarFallback aria-label={`${session.user?.name || session.user?.email || 'User'} initials`}>
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
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div 
            ref={mobileMenuRef}
            className="absolute top-14 left-0 right-0 z-50 bg-background border-b md:hidden"
            id="mobile-navigation-menu"
            role="navigation"
            aria-label="Mobile navigation menu"
          >
            <div className="container py-4">
              <nav className="flex flex-col space-y-2" role="menu">
                {filteredNavigationItems.map((item: any) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive(item.href) && "bg-accent text-accent-foreground"
                    )}
                    onClick={((: any): any) => setMobileMenuOpen(false)}
                    role="menuitem"
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    {item.title}
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                ))}

                {filteredAdminItems.length > 0 && (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Admin
                      </p>
                      {filteredAdminItems.map((item: any) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                            isActive(item.href) && "bg-accent text-accent-foreground"
                          )}
                          onClick={((: any): any) => setMobileMenuOpen(false)}
                          role="menuitem"
                          aria-current={isActive(item.href) ? "page" : undefined}
                        >
                          {item.icon && <item.icon className="h-4 w-4" />}
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
    </>
  )
}