/** @jest-environment node */
/** Tests for unified BFF route /api/go/[...path] */
import * as bff from '@/app/api/go/[...path]/route'

describe('/api/go/[...path] route', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    // Mock upstream fetch: returns 200 with simple body
    // @ts-expect-error override in test
    global.fetch = jest.fn(async () => new Response('pong', { status: 200, headers: { 'content-type': 'text/plain' } }))
  })

  afterEach(() => {
    // @ts-expect-error restore
    global.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('adds X-BFF-Enforced and x-request-id on success', async () => {
    const req = new Request('http://localhost/api/go/api/v1/ping', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await bff.GET(req, { params: { path: ['api', 'v1', 'ping'] } })
    expect(res.status).toBe(200)
    expect(res.headers.get('X-BFF-Enforced')).toBe('1')
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })
})
