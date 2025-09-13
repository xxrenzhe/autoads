import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/v5-config'
import { OptimizedConfigurationService } from '@/lib/services/optimized/config-service'

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'

// Initialize configuration service
let configService: OptimizedConfigurationService | null = null

async function getConfigService(): Promise<OptimizedConfigurationService> {
  if (!configService) {
    configService = new OptimizedConfigurationService()
  }
  return configService
}

// GET /api/admin/config - Get all configurations
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeSecrets = searchParams.get('includeSecrets') === 'true'

    const service = await getConfigService()
    
    const configurations = await service.getConfigs(category || undefined)
    
    // Filter out secrets unless explicitly requested and user is SUPER_ADMIN
    const filteredConfigs = configurations.map((config: any) => ({
      ...config,
      value: (config.isSecret && !includeSecrets) || (config.isSecret && session.user.role !== 'SUPER_ADMIN') 
        ? '***HIDDEN***' 
        : config.value
    }))

    const stats = await service.getConfigStatistics()

    return NextResponse.json({
      configurations: filteredConfigs,
      statistics: stats
    })
  } catch (error) {
    console.error('Failed to get configurations:', error)
    return NextResponse.json(
      { error: 'Failed to get configurations' },
      { status: 500 }
    )
  }
}

// POST /api/admin/config - Create new configuration
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      key,
      value,
      type,
      category,
      description,
      isSecret = false,
      isHotReload = false,
      validationRule,
      defaultValue
    } = body

    if (!key || !value || !type || !category || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const service = await getConfigService()
    
    await service.createConfig({
      key,
      value,
      type,
      category,
      description,
      isSecret,
      isHotReload,
      validationType: validationRule || 'none'
    }, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to create configuration:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create configuration' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/config - Bulk update configurations
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { updates, reason } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      )
    }

    const service = await getConfigService()
    
    await service.bulkUpdateConfigs(updates, session.user?.id || '', reason)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update configurations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update configurations' },
      { status: 500 }
    )
  }
}