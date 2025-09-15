import * as bff from '@/app/api/go/[...path]/route'

describe('BFF readiness and header passthrough', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    // @ts-expect-error restore
    global.fetch = originalFetch
    jest.resetAllMocks()
    ;(globalThis as any).__go_ready_cache = undefined
  })

  it('returns 503 when readyz fails', async () => {
    // first call: readiness -> fail
    // @ts-expect-error override
    global.fetch = jest.fn(async (input: any) => {
      if (String(input).includes('/readyz')) {
        return new Response('not ready', { status: 500 })
      }
      return new Response('ok', { status: 200 })
    })

    const req = new Request('http://localhost/api/go/api/v1/echo', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await bff.GET(req, { params: { path: ['api', 'v1', 'echo'] } })
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('2')
    expect(res.headers.get('X-BFF-Enforced')).toBe('1')
  })

  it('passes through rate limit headers from upstream', async () => {
    // readyz ok then upstream responds with rate limit headers
    // @ts-expect-error override
    global.fetch = jest.fn(async (input: any) => {
      if (String(input).includes('/readyz')) {
        return new Response('ready', { status: 200 })
      }
      return new Response('data', {
        status: 200,
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '29',
          'X-RateLimit-Reset': String(Date.now() + 60_000)
        }
      })
    })

    const req = new Request('http://localhost/api/go/api/v1/limit', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await bff.GET(req, { params: { path: ['api', 'v1', 'limit'] } })
    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('29')
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy()
    expect(res.headers.get('X-BFF-Enforced')).toBe('1')
  })
})

