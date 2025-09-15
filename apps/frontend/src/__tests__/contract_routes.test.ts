/** @jest-environment node */
import * as siterankCatchAll from '@/app/api/siterank/[...path]/route'
import * as batchopenCatchAll from '@/app/api/batchopen/[...path]/route'
import * as adscenterCatchAll from '@/app/api/adscenter/[...path]/route'

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
    const res = await siterankCatchAll.GET(req, { params: { path: ['rank'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/siterank/rank?domain=abc.com')
  })

  it('siterank batch forwards', async () => {
    const req = new Request('http://localhost/api/siterank/batch', { method: 'POST', body: JSON.stringify({ domains: ['a.com'] }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await siterankCatchAll.POST(req, { params: { path: ['batch'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/siterank/batch')
  })

  it('batchopen silent-start forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/silent-start', { method: 'POST', body: JSON.stringify({ urls: ['https://a.com'], cycleCount: 1 }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await batchopenCatchAll.POST(req, { params: { path: ['silent-start'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/start?type=silent')
  })

  it('batchopen silent-progress forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/silent-progress?taskId=abc', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await batchopenCatchAll.GET(req, { params: { path: ['silent-progress'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/progress?taskId=abc')
  })

  it('batchopen silent-terminate forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/silent-terminate', { method: 'POST', body: JSON.stringify({ taskId: 'abc' }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await batchopenCatchAll.POST(req, { params: { path: ['silent-terminate'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/terminate')
  })

  it('adscenter executions GET forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/executions', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await adscenterCatchAll.GET(req, { params: { path: ['executions'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/executions')
  })

  it('adscenter accounts forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/accounts', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await adscenterCatchAll.GET(req, { params: { path: ['accounts'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/accounts')
  })

  it('adscenter configurations forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/configurations', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await adscenterCatchAll.GET(req, { params: { path: ['configurations'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/configurations')
  })

  it('adscenter executions POST forwards', async () => {
    const req = new Request('http://localhost/api/adscenter/executions', { method: 'POST', body: JSON.stringify({ configurationId: 'cfg1' }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await adscenterCatchAll.POST(req, { params: { path: ['executions'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/adscenter/executions')
  })

  it('batchopen version forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/version?feature=batchopen', { method: 'GET' })
    // @ts-expect-error route signature
    const res = await batchopenCatchAll.GET(req, { params: { path: ['version'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/version?feature=batchopen')
  })

  it('batchopen proxy-url-validate forwards', async () => {
    const req = new Request('http://localhost/api/batchopen/proxy-url-validate', { method: 'POST', body: JSON.stringify({ proxyUrl: 'http://1.2.3.4:8080' }), headers: { 'content-type': 'application/json' } })
    // @ts-expect-error route signature
    const res = await batchopenCatchAll.POST(req, { params: { path: ['proxy-url-validate'] } })
    expect(res.status).toBe(200)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(String(url)).toContain('/api/go/api/v1/batchopen/proxy-url-validate')
  })
})
