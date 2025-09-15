import * as rankRoute from '@/app/api/siterank/rank/route'
import * as batchRoute from '@/app/api/siterank/batch/route'
import * as batchMinimalRoute from '@/app/api/siterank/batch-minimal/route'
import * as silentStart from '@/app/api/batchopen/silent-start/route'
import * as silentProgress from '@/app/api/batchopen/silent-progress/route'
import * as accountsRoute from '@/app/api/adscenter/accounts/route'
import * as configsRoute from '@/app/api/adscenter/configurations/route'
import * as execsRoute from '@/app/api/adscenter/executions/route'
import * as versionRoute from '@/app/api/batchopen/version/route'
import * as proxyValidateRoute from '@/app/api/batchopen/proxy-url-validate/route'

describe('Contract routes forward to /api/go', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    // @ts-expect-error override
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ ok: true, data: {} }), { status: 200, headers: { 'content-type': 'application/json' } }))
  })
  afterEach(() => {
    // @ts-expect-error restore
    global.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('siterank rank forwards with query', async () => {
    const req = new Request('http://localhost/api/siterank/rank?domain=abc.com', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await rankRoute.GET(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/siterank/rank?domain=abc.com')
  })

  it('siterank batch forwards', async () => {
    const req = new Request('http://localhost/api/siterank/batch', { method: 'POST', body: JSON.stringify({ domains: ['a.com'] }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await batchRoute.POST(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/siterank/batch')
  })

  it('batchopen silent-start forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/silent-start', { method: 'POST', body: JSON.stringify({ urls: ['https://a.com'], cycleCount: 1 }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await silentStart.POST(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/start?type=silent')
  })

  it('batchopen silent-progress forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/silent-progress?taskId=abc', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await silentProgress.GET(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/progress?taskId=abc')
  })

  it('batchopen silent-terminate forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/silent-terminate', { method: 'POST', body: JSON.stringify({ taskId: 'abc' }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const route = await import('@/app/api/batchopen/silent-terminate/route')
    // @ts-expect-error route signature
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/terminate')
  })

  it('adscenter executions GET forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/executions', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await execsRoute.GET(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/executions')
  })

  it('adscenter accounts forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/accounts', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await accountsRoute.GET(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/accounts')
  })

  it('adscenter configurations forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/configurations', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await configsRoute.GET(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/configurations')
  })

  it('adscenter executions POST forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/executions', { method: 'POST', body: JSON.stringify({ configurationId: 'cfg1' }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await execsRoute.POST(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/executions')
  })

  it('batchopen version forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/version?feature=batchopen', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await versionRoute.GET(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/version?feature=batchopen')
  })

  it('batchopen proxy-url-validate forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/proxy-url-validate', { method: 'POST', body: JSON.stringify({ proxyUrl: 'http://1.2.3.4:8080' }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await proxyValidateRoute.POST(req)
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/proxy-url-validate')
  })
})
