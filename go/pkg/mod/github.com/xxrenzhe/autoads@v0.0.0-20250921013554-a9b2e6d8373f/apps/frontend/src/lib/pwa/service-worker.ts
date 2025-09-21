// Service Worker for PWA functionality
declare const self: ServiceWorkerGlobalScope

interface ServiceWorkerGlobalScope {
  addEventListener(type: string, listener: (event: Event) => void): void
  skipWaiting(): Promise<void>
  clients: Clients
}

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<any>): void
}

interface FetchEvent extends Event {
  request: Request
  respondWith(response: Promise<Response> | Response): void
}

interface Clients {
  claim(): Promise<void>
}

const CACHE_NAME = 'autoads-v1'
const STATIC_CACHE = 'autoads-static-v1'
const DYNAMIC_CACHE = 'autoads-dynamic-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/pricing',
  '/offline',
  '/manifest.json',
  // Add critical CSS and JS files
  '/_next/static/css/app.css',
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/webpack.js',
  // Icons
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
]

// API endpoints to cache
const API_CACHE_PATTERNS = [
  '/api/user/tokens/balance',
  '/api/user/access-control/availability'
]

// Install event - cache static assets
self.addEventListener('install', (event: any) => {
  console.log('Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('Service Worker: Static assets cached')
        return self.skipWaiting()
      })
      .catch(error => {
        console.error('Service Worker: Error caching static assets', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event: any) => {
  console.log('Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map((cacheName: any) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName)
              return caches.delete(cacheName)
            }
            return Promise.resolve()
          })
        )
      })
      .then(() => {
        console.log('Service Worker: Activated')
        return self.clients.claim()
      })
  )
})

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event: any) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return
  }

  // Handle different types of requests
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request))
  } else if (isAPIRequest(request.url)) {
    event.respondWith(networkFirst(request))
  } else if (isPageRequest(request)) {
    event.respondWith(staleWhileRevalidate(request))
  } else {
    event.respondWith(networkFirst(request))
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event: any) => {
  console.log('Service Worker: Background sync', event.tag)
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

// Push notifications
self.addEventListener('push', (event: any) => {
  console.log('Service Worker: Push received', event)
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from AutoAds',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Dashboard',
        icon: '/icons/action-dashboard.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/action-close.png'
      }
    ]
  }
  
  event.waitUntil(
    (self as any).registration.showNotification('AutoAds', options)
  )
})

// Notification click
self.addEventListener('notificationclick', (event: any) => {
  console.log('Service Worker: Notification click', event)
  
  event.notification.close()
  
  if (event.action === 'explore') {
    event.waitUntil(
      (self as any).clients.openWindow('/dashboard')
    )
  } else if (event.action === 'close') {
    // Just close the notification
  } else {
    // Default action - open the app
    event.waitUntil(
      (self as any).clients.openWindow('/')
    )
  }
})

// Cache strategies
async function cacheFirst(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.error('Cache first strategy failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok && isAPIRequest(request.url)) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('Network first fallback to cache:', request.url)
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page for navigation requests
    if (isPageRequest(request)) {
      const offlinePage = await caches.match('/offline')
      if (offlinePage) {
        return offlinePage
      }
    }
    
    return new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(DYNAMIC_CACHE)
  const cachedResponse = await cache.match(request)
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  }).catch(() => cachedResponse || new Response('Network error', { status: 503 }))
  
  return cachedResponse || await fetchPromise
}

// Helper functions
function isStaticAsset(url: string): boolean {
  return url.includes('/_next/static/') || 
         url.includes('/icons/') || 
         url.endsWith('.css') || 
         url.endsWith('.js') ||
         url.endsWith('.png') ||
         url.endsWith('.jpg') ||
         url.endsWith('.svg')
}

function isAPIRequest(url: string): boolean {
  return url.includes('/api/') || API_CACHE_PATTERNS.some(pattern => url.includes(pattern))
}

function isPageRequest(request: Request): boolean {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && (request.headers.get('accept')?.includes('text/html') || false))
}

async function doBackgroundSync(): Promise<void> {
  console.log('Service Worker: Performing background sync')
  
  // Sync offline actions stored in IndexedDB
  try {
    // This would sync any offline actions like token usage, etc.
    // Implementation would depend on specific offline functionality needed
    console.log('Background sync completed')
  } catch (error) {
    console.error('Background sync failed:', error)
    throw error
  }
}

// Export for TypeScript
export {}