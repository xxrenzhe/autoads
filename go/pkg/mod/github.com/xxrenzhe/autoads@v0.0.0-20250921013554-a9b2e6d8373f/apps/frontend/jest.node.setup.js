import { TextEncoder, TextDecoder } from 'util'

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

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

// Mock fetch
global.fetch = jest.fn()

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123'

// Mock auth for server-side tests
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

// Suppress console warnings in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning:') || args[0].includes('Failed to clean'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})