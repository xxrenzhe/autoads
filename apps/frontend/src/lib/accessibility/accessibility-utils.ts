// Accessibility utilities for WCAG 2.1 AA compliance

export interface AccessibilityConfig {
  enableHighContrast: boolean
  enableReducedMotion: boolean
  enableLargeText: boolean
  enableScreenReader: boolean
  keyboardNavigation: boolean
}

export class AccessibilityManager {
  private config: AccessibilityConfig = {
    enableHighContrast: false,
    enableReducedMotion: false,
    enableLargeText: false,
    enableScreenReader: false,
    keyboardNavigation: true
  }

  /**
   * Initialize accessibility features
   */
  initialize(): void {
    if (typeof window === 'undefined') return

    // Load user preferences
    this.loadPreferences()

    // Set up media query listeners
    this.setupMediaQueryListeners()

    // Set up keyboard navigation
    this.setupKeyboardNavigation()

    // Set up focus management
    this.setupFocusManagement()

    // Set up screen reader support
    this.setupScreenReaderSupport()

    // Apply initial settings
    this.applySettings()
  }

  /**
   * Load accessibility preferences from localStorage
   */
  private loadPreferences(): void {
    try {
      const saved = localStorage.getItem('accessibility-preferences')
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) }
      }
    } catch (error) {
      console.error('Failed to load accessibility preferences:', error)
    }
  }

  /**
   * Save accessibility preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem('accessibility-preferences', JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save accessibility preferences:', error)
    }
  }

  /**
   * Set up media query listeners for system preferences
   */
  private setupMediaQueryListeners(): void {
    // High contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)')
    highContrastQuery.addEventListener('change', (e) => {
      this.setHighContrast(e.matches)
    })
    if (highContrastQuery.matches) {
      this.setHighContrast(true)
    }

    // Reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionQuery.addEventListener('change', (e) => {
      this.setReducedMotion(e.matches)
    })
    if (reducedMotionQuery.matches) {
      this.setReducedMotion(true)
    }

    // Color scheme preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    darkModeQuery.addEventListener('change', (e) => {
      this.handleColorSchemeChange(e.matches ? 'dark' : 'light')
    })
  }

  /**
   * Set up keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    if (!this.config.keyboardNavigation) return

    // Skip links for keyboard users
    this.createSkipLinks()

    // Focus visible indicators
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation')
      }
    })

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-navigation')
    })

    // Escape key handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.handleEscapeKey()
      }
    })

    // Arrow key navigation for menus and lists
    this.setupArrowKeyNavigation()
  }

  /**
   * Create skip links for keyboard navigation
   */
  private createSkipLinks(): void {
    const skipLinks = document.createElement('div')
    skipLinks.className = 'skip-links'
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
      <a href="#search" class="skip-link">Skip to search</a>
    `

    // Add CSS for skip links
    const style = document.createElement('style')
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -40px;
        left: 6px;
        z-index: 1000;
      }
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: #000;
        color: #fff;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        font-size: 14px;
        font-weight: bold;
        z-index: 1001;
      }
      .skip-link:focus {
        top: 6px;
      }
    `

    document.head.appendChild(style)
    document.body.insertBefore(skipLinks, document.body.firstChild)
  }

  /**
   * Set up focus management
   */
  private setupFocusManagement(): void {
    // Focus trap for modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modal = document.querySelector('[role="dialog"]:not([aria-hidden="true"])')
        if (modal) {
          this.trapFocus(e, modal as HTMLElement)
        }
      }
    })

    // Restore focus when modals close
    this.setupFocusRestore()
  }

  /**
   * Trap focus within an element
   */
  private trapFocus(event: KeyboardEvent, element: HTMLElement): void {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus()
        event.preventDefault()
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus()
        event.preventDefault()
      }
    }
  }

  /**
   * Set up focus restore functionality
   */
  private setupFocusRestore(): void {
    let lastFocusedElement: HTMLElement | null = null

    // Store focus when modal opens
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement
      if (!target.closest('[role="dialog"]')) {
        lastFocusedElement = target
      }
    })

    // Restore focus when modal closes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
          const target = mutation.target as HTMLElement
          if (target.getAttribute('role') === 'dialog' && target.getAttribute('aria-hidden') === 'true') {
            if (lastFocusedElement) {
              lastFocusedElement.focus()
            }
          }
        }
      })
    })

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden']
    })
  }

  /**
   * Set up screen reader support
   */
  private setupScreenReaderSupport(): void {
    // Live regions for dynamic content
    this.createLiveRegions()

    // Announce page changes
    this.setupPageChangeAnnouncements()

    // Enhance form labels and descriptions
    this.enhanceFormAccessibility()
  }

  /**
   * Create ARIA live regions
   */
  private createLiveRegions(): void {
    // Polite announcements
    const politeRegion = document.createElement('div')
    politeRegion.id = 'aria-live-polite'
    politeRegion.setAttribute('aria-live', 'polite')
    politeRegion.setAttribute('aria-atomic', 'true')
    politeRegion.className = 'sr-only'
    document.body.appendChild(politeRegion)

    // Assertive announcements
    const assertiveRegion = document.createElement('div')
    assertiveRegion.id = 'aria-live-assertive'
    assertiveRegion.setAttribute('aria-live', 'assertive')
    assertiveRegion.setAttribute('aria-atomic', 'true')
    assertiveRegion.className = 'sr-only'
    document.body.appendChild(assertiveRegion)

    // Status announcements
    const statusRegion = document.createElement('div')
    statusRegion.id = 'aria-live-status'
    statusRegion.setAttribute('role', 'status')
    statusRegion.setAttribute('aria-live', 'polite')
    statusRegion.className = 'sr-only'
    document.body.appendChild(statusRegion)
  }

  /**
   * Set up arrow key navigation
   */
  private setupArrowKeyNavigation(): void {
    document.addEventListener('keydown', (e) => {
      const target = e.target as HTMLElement
      
      // Menu navigation
      if (target.getAttribute('role') === 'menuitem') {
        this.handleMenuNavigation(e, target)
      }
      
      // Tab navigation
      if (target.getAttribute('role') === 'tab') {
        this.handleTabNavigation(e, target)
      }
      
      // Listbox navigation
      if (target.getAttribute('role') === 'option') {
        this.handleListboxNavigation(e, target)
      }
    })
  }

  /**
   * Handle escape key press
   */
  private handleEscapeKey(): void {
    // Close open menus
    const openMenus = document.querySelectorAll('[role="menu"]:not([aria-hidden="true"])')
    openMenus.forEach(menu => {
      menu.setAttribute('aria-hidden', 'true')
    })

    // Close modals
    const openModals = document.querySelectorAll('[role="dialog"]:not([aria-hidden="true"])')
    openModals.forEach(modal => {
      modal.setAttribute('aria-hidden', 'true')
    })

    // Clear focus from search inputs
    const searchInputs = document.querySelectorAll('input[type="search"]:focus')
    searchInputs.forEach(input => {
      (input as HTMLInputElement).blur()
    })
  }

  /**
   * Handle menu navigation with arrow keys
   */
  private handleMenuNavigation(event: KeyboardEvent, target: HTMLElement): void {
    const menu = target.closest('[role="menu"]')
    if (!menu) return

    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'))
    const currentIndex = items.indexOf(target)

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        const nextIndex = (currentIndex + 1) % items.length
        ;(items[nextIndex] as HTMLElement).focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        const prevIndex = (currentIndex - 1 + items.length) % items.length
        ;(items[prevIndex] as HTMLElement).focus()
        break
      case 'Home':
        event.preventDefault()
        ;(items[0] as HTMLElement).focus()
        break
      case 'End':
        event.preventDefault()
        ;(items[items.length - 1] as HTMLElement).focus()
        break
    }
  }

  /**
   * Handle tab navigation with arrow keys
   */
  private handleTabNavigation(event: KeyboardEvent, target: HTMLElement): void {
    const tablist = target.closest('[role="tablist"]')
    if (!tablist) return

    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'))
    const currentIndex = tabs.indexOf(target)

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        const nextIndex = (currentIndex + 1) % tabs.length
        ;(tabs[nextIndex] as HTMLElement).focus()
        ;(tabs[nextIndex] as HTMLElement).click()
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
        ;(tabs[prevIndex] as HTMLElement).focus()
        ;(tabs[prevIndex] as HTMLElement).click()
        break
      case 'Home':
        event.preventDefault()
        ;(tabs[0] as HTMLElement).focus()
        ;(tabs[0] as HTMLElement).click()
        break
      case 'End':
        event.preventDefault()
        ;(tabs[tabs.length - 1] as HTMLElement).focus()
        ;(tabs[tabs.length - 1] as HTMLElement).click()
        break
    }
  }

  /**
   * Handle listbox navigation with arrow keys
   */
  private handleListboxNavigation(event: KeyboardEvent, target: HTMLElement): void {
    const listbox = target.closest('[role="listbox"]')
    if (!listbox) return

    const options = Array.from(listbox.querySelectorAll('[role="option"]'))
    const currentIndex = options.indexOf(target)

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        const nextIndex = Math.min(currentIndex + 1, options.length - 1)
        ;(options[nextIndex] as HTMLElement).focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        const prevIndex = Math.max(currentIndex - 1, 0)
        ;(options[prevIndex] as HTMLElement).focus()
        break
      case 'Home':
        event.preventDefault()
        ;(options[0] as HTMLElement).focus()
        break
      case 'End':
        event.preventDefault()
        ;(options[options.length - 1] as HTMLElement).focus()
        break
    }
  }

  /**
   * Set up page change announcements
   */
  private setupPageChangeAnnouncements(): void {
    // Announce route changes
    let currentPath = window.location.pathname
    
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname
        this.announcePageChange()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  /**
   * Announce page change to screen readers
   */
  private announcePageChange(): void {
    const title = document.title
    this.announce(`Navigated to ${title}`, 'polite')
  }

  /**
   * Enhance form accessibility
   */
  private enhanceFormAccessibility(): void {
    // Add required indicators
    const requiredInputs = document.querySelectorAll('input[required], select[required], textarea[required]')
    requiredInputs.forEach(input => {
      const label = document.querySelector(`label[for="${input.id}"]`)
      if (label && !label.textContent?.includes('*')) {
        label.innerHTML += ' <span aria-label="required">*</span>'
      }
    })

    // Enhance error messages
    const errorMessages = document.querySelectorAll('[role="alert"]')
    errorMessages.forEach(error => {
      if (!error.getAttribute('aria-live')) {
        error.setAttribute('aria-live', 'assertive')
      }
    })
  }

  /**
   * Handle color scheme changes
   */
  private handleColorSchemeChange(scheme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-color-scheme', scheme)
  }

  /**
   * Public methods for setting accessibility preferences
   */
  setHighContrast(enabled: boolean): void {
    this.config.enableHighContrast = enabled
    document.documentElement.classList.toggle('high-contrast', enabled)
    this.savePreferences()
  }

  setReducedMotion(enabled: boolean): void {
    this.config.enableReducedMotion = enabled
    document.documentElement.classList.toggle('reduced-motion', enabled)
    this.savePreferences()
  }

  setLargeText(enabled: boolean): void {
    this.config.enableLargeText = enabled
    document.documentElement.classList.toggle('large-text', enabled)
    this.savePreferences()
  }

  setScreenReader(enabled: boolean): void {
    this.config.enableScreenReader = enabled
    this.savePreferences()
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: 'polite' | 'assertive' | 'status' = 'polite'): void {
    const region = document.getElementById(`aria-live-${priority}`)
    if (region) {
      region.textContent = message
      setTimeout(() => {
        region.textContent = ''
      }, 1000)
    }
  }

  /**
   * Apply all accessibility settings
   */
  private applySettings(): void {
    this.setHighContrast(this.config.enableHighContrast)
    this.setReducedMotion(this.config.enableReducedMotion)
    this.setLargeText(this.config.enableLargeText)
  }

  /**
   * Get current accessibility configuration
   */
  getConfig(): AccessibilityConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const accessibilityManager = new AccessibilityManager()

// Utility functions
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' | 'status' = 'polite'): void {
  accessibilityManager.announce(message, priority)
}

export function isReducedMotionPreferred(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isHighContrastPreferred(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches
}

export function isDarkModePreferred(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}