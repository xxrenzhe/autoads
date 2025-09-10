// PWA utility functions
export interface PWAInstallPrompt {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface PWACapabilities {
  isInstallable: boolean
  isInstalled: boolean
  isOnline: boolean
  hasNotificationPermission: boolean
  supportsPush: boolean
  supportsBackgroundSync: boolean
}

export class PWAManager {
  private installPrompt: PWAInstallPrompt | null = null
  private registration: ServiceWorkerRegistration | null = null

  /**
   * Initialize PWA functionality
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return

    // Register service worker
    await this.registerServiceWorker()

    // Set up install prompt
    this.setupInstallPrompt()

    // Set up online/offline detection
    this.setupNetworkDetection()

    // Request notification permission
    await this.requestNotificationPermission()
  }

  /**
   * Register service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })

        console.log('Service Worker registered:', this.registration)

        // Handle updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration?.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                this.showUpdateAvailable()
              }
            })
          }
        })
      } catch (error) {
        console.error('Service Worker registration failed:', error)
      }
    }
  }

  /**
   * Set up install prompt handling
   */
  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      this.installPrompt = event as any
      this.showInstallPrompt()
    })

    window.addEventListener('appinstalled', () => {
      console.log('PWA installed')
      this.hideInstallPrompt()
      this.installPrompt = null
    })
  }

  /**
   * Set up network detection
   */
  private setupNetworkDetection(): void {
    window.addEventListener('online', () => {
      this.handleOnline()
    })

    window.addEventListener('offline', () => {
      this.handleOffline()
    })
  }

  /**
   * Show install prompt
   */
  private showInstallPrompt(): void {
    // Create install prompt UI
    const installBanner = document.createElement('div')
    installBanner.id = 'pwa-install-banner'
    installBanner.className = 'fixed bottom-4 left-4 right-4 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg z-50 flex items-center justify-between'
    installBanner.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
          </svg>
        </div>
        <div>
          <div class="font-medium">Install AutoAds</div>
          <div class="text-sm opacity-90">Get quick access from your home screen</div>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="pwa-install-dismiss" class="px-3 py-1 text-sm bg-white/20 rounded hover:bg-white/30">
          Later
        </button>
        <button id="pwa-install-accept" class="px-3 py-1 text-sm bg-white text-primary rounded hover:bg-white/90">
          Install
        </button>
      </div>
    `

    document.body.appendChild(installBanner)

    // Handle install actions
    document.getElementById('pwa-install-accept')?.addEventListener('click', () => {
      this.installApp()
    })

    document.getElementById('pwa-install-dismiss')?.addEventListener('click', () => {
      this.hideInstallPrompt()
    })
  }

  /**
   * Hide install prompt
   */
  private hideInstallPrompt(): void {
    const banner = document.getElementById('pwa-install-banner')
    if (banner) {
      banner.remove()
    }
  }

  /**
   * Install the app
   */
  async installApp(): Promise<void> {
    if (!this.installPrompt) return

    try {
      await this.installPrompt.prompt()
      const choice = await this.installPrompt.userChoice
      
      if (choice.outcome === 'accepted') {
        console.log('User accepted the install prompt')
      } else {
        console.log('User dismissed the install prompt')
      }
    } catch (error) {
      console.error('Error installing app:', error)
    }

    this.hideInstallPrompt()
    this.installPrompt = null
  }

  /**
   * Handle online state
   */
  private handleOnline(): void {
    console.log('App is online')
    this.hideOfflineBanner()
    
    // Sync any offline data
    if (this.registration && 'sync' in this.registration) {
      (this.registration as any).sync.register('background-sync').catch(console.error)
    }
  }

  /**
   * Handle offline state
   */
  private handleOffline(): void {
    console.log('App is offline')
    this.showOfflineBanner()
  }

  /**
   * Show offline banner
   */
  private showOfflineBanner(): void {
    if (document.getElementById('offline-banner')) return

    const offlineBanner = document.createElement('div')
    offlineBanner.id = 'offline-banner'
    offlineBanner.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 p-2 text-center text-sm z-50'
    offlineBanner.innerHTML = `
      <div class="flex items-center justify-center gap-2">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        You're offline. Some features may be limited.
      </div>
    `

    document.body.appendChild(offlineBanner)
  }

  /**
   * Hide offline banner
   */
  private hideOfflineBanner(): void {
    const banner = document.getElementById('offline-banner')
    if (banner) {
      banner.remove()
    }
  }

  /**
   * Show update available notification
   */
  private showUpdateAvailable(): void {
    const updateBanner = document.createElement('div')
    updateBanner.id = 'update-banner'
    updateBanner.className = 'fixed top-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm'
    updateBanner.innerHTML = `
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
        </svg>
        <div class="flex-1">
          <div class="font-medium">Update Available</div>
          <div class="text-sm opacity-90 mt-1">A new version of AutoAds is ready to install.</div>
          <div class="flex gap-2 mt-3">
            <button id="update-dismiss" class="px-3 py-1 text-sm bg-white/20 rounded hover:bg-white/30">
              Later
            </button>
            <button id="update-install" class="px-3 py-1 text-sm bg-white text-blue-500 rounded hover:bg-white/90">
              Update
            </button>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(updateBanner)

    // Handle update actions
    document.getElementById('update-install')?.addEventListener('click', () => {
      this.updateApp()
    })

    document.getElementById('update-dismiss')?.addEventListener('click', () => {
      updateBanner.remove()
    })
  }

  /**
   * Update the app
   */
  private updateApp(): void {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied'
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission()
    }

    return Notification.permission
  }

  /**
   * Get PWA capabilities
   */
  getCapabilities(): PWACapabilities {
    return {
      isInstallable: !!this.installPrompt,
      isInstalled: window.matchMedia('(display-mode: standalone)').matches,
      isOnline: navigator.onLine,
      hasNotificationPermission: Notification.permission === 'granted',
      supportsPush: 'PushManager' in window,
      supportsBackgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration || !('PushManager' in window)) {
      return null
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      })

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      })

      return subscription
    } catch (error) {
      console.error('Error subscribing to push notifications:', error)
      return null
    }
  }
}

// Export singleton instance
export const pwaManager = new PWAManager()

// Utility functions
export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true
}

export function isOnline(): boolean {
  return navigator.onLine
}

export function canInstallPWA(): boolean {
  return !isPWAInstalled() && 'serviceWorker' in navigator
}