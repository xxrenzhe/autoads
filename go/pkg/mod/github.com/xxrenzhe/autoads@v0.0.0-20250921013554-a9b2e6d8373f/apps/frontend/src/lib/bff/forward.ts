export type ForwardOptions = {
  targetPath: string
  method?: string
  appendSearch?: boolean
}

/**
 * Forward current Next.js Route Handler request to unified BFF entry
 * Keeps headers and body, injects target path.
 */
export async function forwardToGo(req: Request, opts: ForwardOptions): Promise<Response> {
  const { targetPath, method, appendSearch = true } = opts
  const url = new URL(req.url)
  const search = appendSearch ? url.search : ''
  const bffPath = targetPath.startsWith('/api/go') ? targetPath : `/api/go${targetPath}`
  const target = `${bffPath}${search}`

  const headers = new Headers(req.headers)
  // Remove hop-by-hop
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('accept-encoding')

  let body: BodyInit | undefined = undefined
  const m = (method || req.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD'].includes(m)) {
    // Clone body as text (safer across environments)
    const text = await req.text().catch(() => '')
    if (text) body = text
  }

  return fetch(target, { method: m, headers, body, redirect: 'manual' })
}

