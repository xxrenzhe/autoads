export function ensureNextWriteAllowed(): void {
  const isDev = (process.env.NODE_ENV || '').toLowerCase() === 'development'
  const allow = process.env.ALLOW_NEXT_WRITES === 'true'
  if (!isDev && !allow) {
    const err: any = new Error('Next API writes are disabled on this deployment')
    err.status = 501
    throw err
  }
}

