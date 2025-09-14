import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { tokenConfigService } from '@/lib/services/token-config'
import { auditLogger } from '@/lib/security/audit/audit-logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    await auditLogger.logSecurity('token_config_read', 'failure', { reason: 'forbidden' })
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  try {
    const cfg = await tokenConfigService.getTokenConfig()
    await auditLogger.logAdmin('read', 'token_config', session.user.id, 'success')
    return NextResponse.json({ success: true, data: cfg })
  } catch (e) {
    await auditLogger.logAdmin('read', 'token_config', session.user.id, 'error', { error: String(e) })
    return NextResponse.json({ success: false, error: 'Failed to load config' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    await auditLogger.logSecurity('token_config_update', 'failure', { reason: 'forbidden' })
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const updated = await tokenConfigService.updateTokenConfig(body || {}, session.user.id, 'Admin panel update')
    await auditLogger.logAdmin('update', 'token_config', session.user.id, 'success', { changes: body })
    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    await auditLogger.logAdmin('update', 'token_config', session.user.id, 'error', { error: String(e) })
    return NextResponse.json({ success: false, error: 'Failed to update config' }, { status: 500 })
  }
}
