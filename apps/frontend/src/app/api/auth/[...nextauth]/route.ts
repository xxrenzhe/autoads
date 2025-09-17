import { handlers } from '@/lib/auth/v5-config'
export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'

// Export the handlers directly for GET requests
export const GET = handlers.GET

// Export the handlers directly for POST requests without custom handling
export const POST = handlers.POST
