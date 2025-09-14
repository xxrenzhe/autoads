import { NextRequest, NextResponse } from 'next/server'
import { requireFeature } from '@/lib/utils/subscription-based-api'
import { withApiProtection } from '@/lib/api-utils'
import { BatchOpenPermissionService, BATCHOPEN_VERSIONS } from '@/lib/services/batchopen-permission-service'

async function getBatchopenVersions(request: NextRequest, context: any) {
  try {
    const { searchParams } = new URL(request.url)
    const feature = searchParams.get('feature')

    if (feature !== 'batchopen') {
      return NextResponse.json({ error: 'Invalid feature' }, { status: 400 })
    }

    // Get user's batchopen versions from subscription
    const userVersions = await BatchOpenPermissionService.getUserVersions(context.user.id)

    // Build response with version details
    const versions: Record<string, any> = {}
    for (const [key, versionInfo] of Object.entries(BATCHOPEN_VERSIONS)) {
      versions[key] = {
        available: userVersions.versions[key as keyof typeof userVersions.versions],
        name: versionInfo.name,
        description: versionInfo.description,
        maxUrls: versionInfo.maxUrls,
        maxConcurrent: versionInfo.maxConcurrent,
        features: versionInfo.features
      }
    }

    return NextResponse.json({
      feature: 'batchopen',
      versions,
      availableVersions: userVersions.available,
      highestVersion: userVersions.highest,
      hasAnyAccess: userVersions.available.length > 0,
      subscriptionBased: true,
      userFeatures: context.features,
      userLimits: context.limits
    })
  } catch (error) {
    console.error('Error checking batchopen version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = requireFeature(
  'batchopen_basic',
  withApiProtection('batchOpen')(getBatchopenVersions as any) as any,
  { requireActiveSubscription: false }
);
