// Load DOM matchers only when jsdom is available
try {
  // eslint-disable-next-line global-require
  if (typeof window !== 'undefined') require('@testing-library/jest-dom')
} catch {}
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

// Mock matchMedia
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
// eslint-disable-next-line @typescript-eslint/no-empty-function
if (typeof global.scrollTo === 'undefined') global.scrollTo = jest.fn(() => {})

// Mock fetch
global.fetch = jest.fn()

// Mock localStorage
if (typeof global.localStorage === 'undefined') {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  // @ts-ignore
  global.localStorage = localStorageMock
}

// Mock sessionStorage
if (typeof global.sessionStorage === 'undefined') {
  const sessionStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  // @ts-ignore
  global.sessionStorage = sessionStorageMock
}

// Mock crypto
if (typeof global.crypto === 'undefined') {
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
}

// Mock next/router (only if available in test)
try {
  // eslint-disable-next-line global-require
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
} catch {}

// Mock next/navigation
try {
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
} catch {}

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

// Mock Prisma with comprehensive model coverage
jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    // User model
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    // Subscription model
    subscription: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    // Payment model
    payment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    // System Config model
    systemConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Admin Log model
    adminLog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    // Usage Log model
    usageLog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    // API Usage model
    apiUsage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    // Plan model
    plan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // Transaction methods
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    $use: jest.fn(),
  }
  
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'

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
