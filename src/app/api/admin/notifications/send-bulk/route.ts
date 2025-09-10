import { NextRequest, NextResponse } from 'next/server'

// POST /api/admin/notifications/send-bulk - Send bulk notifications
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Bulk notifications feature is not yet implemented' },
    { status: 503 }
  )
}