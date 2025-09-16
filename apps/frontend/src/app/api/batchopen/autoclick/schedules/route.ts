import { forwardToGo } from '@/lib/bff/forward'

// BFF: /api/batchopen/autoclick/schedules -> /api/v1/batchopen/autoclick/schedules
export async function GET(req: Request) {
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/schedules`, appendSearch: true })
}

export async function POST(req: Request) {
  return forwardToGo(req, { targetPath: `/api/v1/batchopen/autoclick/schedules`, appendSearch: false, method: 'POST' })
}

