import { offlineStorage, OfflineAction } from './offline-storage'

export interface SyncResult {
  success: boolean
  syncedCount: number
  failedCount: number
  errors: string[]
}

export class OfflineSync {
  private isRunning = false
  private maxRetries = 3

  /**
   * Sync all offline actions
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isRunning) {
      return { success: false, syncedCount: 0, failedCount: 0, errors: ['Sync already running'] }
    }

    this.isRunning = true
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: []
    }

    try {
      const actions = await offlineStorage.getUnsyncedActions()
      console.log(`Syncing ${actions.length} offline actions`)

      for (const action of actions) {
        try {
          await this.syncAction(action)
          await offlineStorage.markActionSynced(action.id)
          result.syncedCount++
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error)
          
          if (action.retryCount < this.maxRetries) {
            await offlineStorage.incrementRetryCount(action.id)
          } else {
            result.errors.push(`Max retries exceeded for action ${action.id}`)
          }
          
          result.failedCount++
        }
      }

      if (result.failedCount > 0) {
        result.success = false
      }

      console.log(`Sync completed: ${result.syncedCount} synced, ${result.failedCount} failed`)
    } catch (error) {
      console.error('Sync failed:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : "Unknown error" as any)
    } finally {
      this.isRunning = false
    }

    return result
  }

  /**
   * Sync a single action
   */
  private async syncAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'token_usage':
        await this.syncTokenUsage(action)
        break
      case 'feature_usage':
        await this.syncFeatureUsage(action)
        break
      case 'user_activity':
        await this.syncUserActivity(action)
        break
      case 'analytics_event':
        await this.syncAnalyticsEvent(action)
        break
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Sync token usage
   */
  private async syncTokenUsage(action: OfflineAction): Promise<void> {
    const response = await fetch('/api/user/tokens/usage/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        feature: action.data.feature,
        operation: action.data.operation,
        tokensConsumed: action.data.tokensConsumed,
        itemCount: action.data.itemCount,
        timestamp: action.timestamp,
        offlineId: action.id
      })
    })

    if (!response.ok) {
      throw new Error(`Token usage sync failed: ${response.statusText}`)
    }
  }

  /**
   * Sync feature usage
   */
  private async syncFeatureUsage(action: OfflineAction): Promise<void> {
    const response = await fetch('/api/user/access-control/usage/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        feature: action.data.feature,
        operation: action.data.operation,
        count: action.data.count,
        timestamp: action.timestamp,
        offlineId: action.id
      })
    })

    if (!response.ok) {
      throw new Error(`Feature usage sync failed: ${response.statusText}`)
    }
  }

  /**
   * Sync user activity
   */
  private async syncUserActivity(action: OfflineAction): Promise<void> {
    const response = await fetch('/api/user/activity/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: action.data.action,
        resource: action.data.resource,
        metadata: action.data.metadata,
        timestamp: action.timestamp,
        offlineId: action.id
      })
    })

    if (!response.ok) {
      throw new Error(`User activity sync failed: ${response.statusText}`)
    }
  }

  /**
   * Sync analytics event
   */
  private async syncAnalyticsEvent(action: OfflineAction): Promise<void> {
    const response = await fetch('/api/analytics/events/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: action.data.event,
        properties: action.data.properties,
        timestamp: action.timestamp,
        offlineId: action.id
      })
    })

    if (!response.ok) {
      throw new Error(`Analytics event sync failed: ${response.statusText}`)
    }
  }

  /**
   * Queue offline action
   */
  async queueAction(type: string, data: any): Promise<string> {
    return await offlineStorage.storeAction({ type, data })
  }

  /**
   * Auto-sync when online
   */
  startAutoSync(): void {
    // Sync when coming online
    window.addEventListener('online', () => {
      setTimeout(() => this.syncAll(), 1000) // Delay to ensure connection is stable
    })

    // Periodic sync when online
    setInterval(() => {
      if (navigator.onLine && !this.isRunning) {
        this.syncAll()
      }
    }, 5 * 60 * 1000) // Every 5 minutes
  }
}

// Export singleton instance
export const offlineSync = new OfflineSync()

// Utility functions for offline actions
export async function recordOfflineTokenUsage(
  feature: string,
  operation: string,
  tokensConsumed: number,
  itemCount: number
): Promise<string> {
  return await offlineSync.queueAction('token_usage', {
    feature,
    operation,
    tokensConsumed,
    itemCount
  })
}

export async function recordOfflineFeatureUsage(
  feature: string,
  operation: string,
  count: number = 1
): Promise<string> {
  return await offlineSync.queueAction('feature_usage', {
    feature,
    operation,
    count
  })
}

export async function recordOfflineUserActivity(
  action: string,
  resource: string,
  metadata?: any
): Promise<string> {
  return await offlineSync.queueAction('user_activity', {
    action,
    resource,
    metadata
  })
}

export async function recordOfflineAnalyticsEvent(
  event: string,
  properties?: any
): Promise<string> {
  return await offlineSync.queueAction('analytics_event', {
    event,
    properties
  })
}