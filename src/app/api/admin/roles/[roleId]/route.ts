import { NextRequest, NextResponse } from 'next/server'

// GET request
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'This feature is not yet implemented' },
    { status: 503 }
  )
}

// POST request
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This feature is not yet implemented' },
    { status: 503 }
  )
}

// PUT request
export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: 'This feature is not yet implemented' },
    { status: 503 }
  )
}

// DELETE request
export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: 'This feature is not yet implemented' },
    { status: 503 }
  )
}
