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
  Bell,
  BookOpen,
  Tag // Pricing icon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import TokenBalanceInline from '@/token/components/TokenBalanceInline'

interface NavigationItem {
  title: string
  href: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string
  requiresAuth?: boolean
  hideWhenAuth?: boolean // New property
  requiresRole?: string[]
}

const navigationItems: NavigationItem[] = [
  {
    title: '仪表盘',
    href: '/dashboard',
    description: '查看您的核心指标和活动',
    icon: BarChart3,
    requiresAuth: true
  },
  {
    title: 'Offer库',
    href: '/offers',
    description: '管理您的所有Offers',
    icon: Search,
    requiresAuth: true
  },
  {
    title: '工作流',
    href: '/workflows',
    description: '自动化您的增长流程',
    icon: Settings,
    requiresAuth: true
  },
  {
    title: '博客',
    href: '/blog',
    description: '获取最新的行业洞察和技巧',
    icon: BookOpen,
  },
  {
    title: '定价',
    href: '/pricing',
    description: '查看我们的套餐计划',
    icon: Tag,
    hideWhenAuth: true, // Hide when user is authenticated
  },
  {
    title: '计费中心',
    href: '/billing',
    description: '管理您的订阅和Token',
    icon: DollarSign,
    requiresAuth: true
  }
]

const adminNavigationItems: NavigationItem[] = []

export default function MainNavigation() {
  const { data: session } = useSession()
  const pathname = usePathname() || ''
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && mobileMenuOpen) {
      setMobileMenuOpen(false)
      mobileMenuButtonRef.current?.focus()
    }
  }

  useEffect(() => {
    if (mobileMenuOpen) {
      const firstLink = mobileMenuRef.current?.querySelector('a')
      firstLink?.focus()
    }
  }, [mobileMenuOpen])

  const hasRole = (requiredRoles?: string[]) => {
    if (!requiredRoles || !session?.user?.role) return false
    return requiredRoles.includes(session.user.role)
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const filteredNavigationItems = navigationItems.filter((item: NavigationItem) => {
    if (item.requiresAuth && !session) return false
    if (item.hideWhenAuth && session) return false // Hide if authenticated
    if (item.requiresRole && !hasRole(item.requiresRole)) return false
    return true
  })

  const filteredAdminItems = adminNavigationItems.filter((item: NavigationItem) => {
    if (item.requiresRole && !hasRole(item.requiresRole)) return false
    return true
  })

  // ... (rest of the component remains the same)
  
  return (
    <>
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
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <div className="h-6 w-6 bg-primary rounded" />
            <span className="hidden font-bold sm:inline-block">AutoAds</span>
          </Link>
        </div>

        <Button
          ref={mobileMenuButtonRef}
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-menu"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          <span className="sr-only">{mobileMenuOpen ? "Close" : "Open"} Menu</span>
        </Button>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
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
                        aria-current={isActive(item.href) ? "page" : undefined}
                      >
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        {item.title}
                      </NavigationMenuLink>
                    </Link>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="flex items-center gap-2">
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image || ''} />
                      <AvatarFallback>{session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link href="/dashboard"><User className="mr-2 h-4 w-4" />Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/api/auth/signout"><LogOut className="mr-2 h-4 w-4" />Log out</Link></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild><Link href="/auth/signin">Sign In</Link></Button>
                <Button size="sm" asChild><Link href="/auth/signin">Get Started</Link></Button>
              </div>
            )}
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div 
            ref={mobileMenuRef}
            className="absolute top-14 left-0 right-0 z-50 bg-background border-b md:hidden"
          >
            <div className="container py-4">
              <nav className="flex flex-col space-y-2">
                {filteredNavigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive(item.href) && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.icon && <item.icon className="h-4 w-4" />}
                    {item.title}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
    </>
  )
}
