import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock matchMedia (only in browser-like environments)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock scrollTo
global.scrollTo = jest.fn()

// Mock fetch
global.fetch = jest.fn()

// Mock localStorage (only in browser-like environments)
if (typeof window !== 'undefined') {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  global.localStorage = localStorageMock

  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  global.sessionStorage = sessionStorageMock
}

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
  },
})

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: class {
    constructor(url, options = {}) {
      this.url = url
      this.method = options.method || 'GET'
      this.headers = new Map(Object.entries(options.headers || {}))
      this.json = async () => options.body ? JSON.parse(options.body) : {}
    }
  },
  NextResponse: {
    json: (data, init = {}) => ({
      status: init.status || 200,
      json: async () => data,
      headers: new Map(Object.entries(init.headers || {})),
    }),
    redirect: (url) => ({
      status: 302,
      headers: new Map([['location', url]]),
    }),
  },
}))

// Mock NextAuth
jest.mock('next-auth', () => ({
  default: jest.fn(),
}))

jest.mock('@auth/core', () => ({
  Auth: jest.fn(),
  customFetch: jest.fn(),
}))

// Mock auth config
jest.mock('@/lib/auth/v5-config', () => ({
  authConfig: {
    debug: false,
    basePath: '/api/auth',
    useSecureCookies: false,
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    providers: [],
    callbacks: {
      authorized: jest.fn(),
      jwt: jest.fn(),
      session: jest.fn(),
    },
  },
  handlers: [],
  GET: jest.fn(),
  POST: jest.fn(),
  auth: jest.fn(() => Promise.resolve({ user: { id: 'admin-user-id', role: 'ADMIN' } })),
}))

// Mock service modules
jest.mock('@/lib/services/permission-service', () => ({
  PermissionService: {
    hasPermission: jest.fn().mockResolvedValue(true),
    isAdmin: jest.fn().mockResolvedValue(true),
    isSuperAdmin: jest.fn().mockResolvedValue(true),
    clearPermissionCache: jest.fn(),
  },
}))

jest.mock('@/lib/services/user-service', () => ({
  UserService: {
    getUserById: jest.fn(),
    getUsers: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    recordBehavior: jest.fn(),
    getUserByEmail: jest.fn(),
  },
}))

jest.mock('@/lib/services/optimized/user-query-service', () => ({
  UserQueryService: {
    getUserBasicInfo: jest.fn(),
    getMultipleUsersBasicInfo: jest.fn(),
    getActiveUsers: jest.fn(),
    updateLastLogin: jest.fn(),
  },
}))

// Load environment variables from .env.test for real database testing
require('dotenv').config({ path: '.env.test' })

// Set test environment if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-key-that-is-at-least-32-characters-long'
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_123'

// Don't override DATABASE_URL - let it load from .env.test

// Suppress console warnings in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})