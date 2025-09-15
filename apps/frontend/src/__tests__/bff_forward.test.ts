/**
 * Tests for forwardToGo helper (no network)
 */
import { forwardToGo } from '@/lib/bff/forward'

describe('forwardToGo', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    // @ts-expect-error allow override for test
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers as any)
      return new Response('ok', { status: 200, headers })
    })
  })

  afterEach(() => {
    // @ts-expect-error restore
    global.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('builds /api/go URL with query and preserves method', async () => {
    const req = new Request('http://localhost/api/some/path?x=1', { method: 'GET' })
    await forwardToGo(req, { targetPath: '/api/v1/ping', appendSearch: true })
    expect(global.fetch).toHaveBeenCalled()
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toBe('/api/go/api/v1/ping?x=1')
    expect(init?.method).toBe('GET')
  })

  it('uses provided method for POST and does not append search when disabled', async () => {
    const req = new Request('http://localhost/api/another?y=2', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      headers: { 'content-type': 'application/json' }
    })
    await forwardToGo(req, { targetPath: '/api/v1/start', appendSearch: false, method: 'POST' })
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toBe('/api/go/api/v1/start')
    expect(init?.method).toBe('POST')
  })
})

