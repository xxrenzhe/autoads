'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

// 架构统一：前端不提供后台入口（后台仅 URL 直达 /ops/console/*）
const adminNavigationItems: NavigationItem[] = []

export function NavigationLinks() {
  const { data: session } = useSession()
  const pathname = usePathname() || ''

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
  const [unread, setUnread] = useState<number>(0)
  const [items, setItems] = useState<Array<{ id: string; title: string; message: string; createdAt?: string }>>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const r = await fetch('/api/go/api/v1/notifications/unread-count', { cache: 'no-store' })
        if (!r.ok) return
        const data = await r.json()
        if (active) setUnread(Number(data.count || 0))
      } catch {}
    }
    if (session) load()
    const t = setInterval(load, 30000)
    return () => { active = false; clearInterval(t) }
  }, [session])

  const openNotifications = async () => {
    try {
      setOpen(true)
      const r = await fetch('/api/go/api/v1/notifications/recent?limit=20', { cache: 'no-store' })
      if (!r.ok) return
      const data = await r.json()
      const list = Array.isArray(data.items) ? data.items : []
      setItems(list)
      // mark read up to last id
      const last = list.length ? list[0].id : ''
      if (last) {
        await fetch('/api/go/api/v1/notifications/read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lastId: String(last) }) })
        setUnread(0)
      }
    } catch {}
  }

  const removeNotification = async (id: string) => {
    try {
      const r = await fetch(`/api/go/api/v1/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (r.status === 204) {
        setItems((prev) => prev.filter((n) => n.id !== id))
      }
    } catch {}
  }

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
        <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) openNotifications() }}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="relative h-8 w-8 px-0">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] leading-none h-4 min-w-[1rem] px-1">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b text-sm font-medium">Notifications</div>
            <div className="max-h-80 overflow-auto divide-y">
              {items.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">No notifications</div>
              )}
              {items.map((n) => (
                <div key={n.id} className="p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{n.message}</div>
                      {n.createdAt && <div className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</div>}
                    </div>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeNotification(n.id) }}
                      aria-label="Delete notification"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
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
