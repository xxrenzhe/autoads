import { forwardToGo } from '@/lib/bff/forward'

describe('BFF /api/v2 forward', () => {
  it('forwards GET with query', async () => {
    const req = new Request('http://localhost/api/v2/tasks/abc?x=1', { method: 'GET' })
    let captured: any = null
    // @ts-ignore
    global.fetch = jest.fn(async (url, init) => { captured = { url, init }; return new Response('ok') })
    await forwardToGo(req, { targetPath: '/api/v2/tasks/abc', appendSearch: true })
    expect(String(captured.url)).toBe('/api/go/api/v2/tasks/abc?x=1')
    expect(captured.init.method).toBe('GET')
  })
  it('forwards POST without search by default when appendSearch=false', async () => {
    const req = new Request('http://localhost/api/v2/batchopen/silent/start?debug=1', { method: 'POST', body: JSON.stringify({ urls: ['a'] }) })
    let captured: any = null
    // @ts-ignore
    global.fetch = jest.fn(async (url, init) => { captured = { url, init }; return new Response('ok') })
    await forwardToGo(req, { targetPath: '/api/v2/batchopen/silent/start', appendSearch: false, method: 'POST' })
    expect(String(captured.url)).toBe('/api/go/api/v2/batchopen/silent/start')
    expect(captured.init.method).toBe('POST')
  })
})

