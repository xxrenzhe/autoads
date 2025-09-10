import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { prisma } from '@/lib/db'

// GET /api/admin/permissions - Get all permissions
export async function GET() {
  return NextResponse.json(
    { error: 'Permissions management feature is not yet implemented' },
    { status: 503 }
  )
}