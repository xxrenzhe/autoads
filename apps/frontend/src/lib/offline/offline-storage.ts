// Offline storage using IndexedDB
export interface OfflineAction {
  id: string
  type: string
  data: any
  timestamp: number
  synced: boolean
  retryCount: number
}

export interface OfflineData {
  id: string
  type: string
  data: any
  timestamp: number
  expiresAt?: number
}

export class OfflineStorage {
  private dbName = 'AutoAdsOffline'
  private version = 1
  private db: IDBDatabase | null = null

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores
        if (!db.objectStoreNames.contains('actions')) {
          const actionsStore = db.createObjectStore('actions', { keyPath: 'id' })
          actionsStore.createIndex('type', 'type', { unique: false })
          actionsStore.createIndex('synced', 'synced', { unique: false })
          actionsStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        if (!db.objectStoreNames.contains('data')) {
          const dataStore = db.createObjectStore('data', { keyPath: 'id' })
          dataStore.createIndex('type', 'type', { unique: false })
          dataStore.createIndex('timestamp', 'timestamp', { unique: false })
          dataStore.createIndex('expiresAt', 'expiresAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' })
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  /**
   * Store an offline action
   */
  async storeAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'synced' | 'retryCount'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const offlineAction: OfflineAction = {
      id,
      ...action,
      timestamp: Date.now(),
      synced: false,
      retryCount: 0
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readwrite')
      const store = transaction.objectStore('actions')
      const request = store.add(offlineAction)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(id)
    })
  }

  /**
   * Get unsynced actions
   */
  async getUnsyncedActions(): Promise<OfflineAction[]> {
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readonly')
      const store = transaction.objectStore('actions')
      const index = store.index('synced')
      const request = index.getAll(IDBKeyRange.only(false))

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  /**
   * Mark action as synced
   */
  async markActionSynced(actionId: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readwrite')
      const store = transaction.objectStore('actions')
      const getRequest = store.get(actionId)

      getRequest.onsuccess = () => {
        const action = getRequest.result
        if (action) {
          action.synced = true
          const putRequest = store.put(action)
          putRequest.onerror = () => reject(putRequest.error)
          putRequest.onsuccess = () => resolve()
        } else {
          resolve()
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Increment retry count for action
   */
  async incrementRetryCount(actionId: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['actions'], 'readwrite')
      const store = transaction.objectStore('actions')
      const getRequest = store.get(actionId)

      getRequest.onsuccess = () => {
        const action = getRequest.result
        if (action) {
          action.retryCount = (action.retryCount || 0) + 1
          const putRequest = store.put(action)
          putRequest.onerror = () => reject(putRequest.error)
          putRequest.onsuccess = () => resolve()
        } else {
          resolve()
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Store offline data
   */
  async storeData(data: Omit<OfflineData, 'id' | 'timestamp'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const id = `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const offlineData: OfflineData = {
      id,
      ...data,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readwrite')
      const store = transaction.objectStore('data')
      const request = store.add(offlineData)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(id)
    })
  }

  /**
   * Get offline data by type
   */
  async getDataByType(type: string): Promise<OfflineData[]> {
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readonly')
      const store = transaction.objectStore('data')
      const index = store.index('type')
      const request = index.getAll(type)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result.filter(item => {
          // Filter out expired data
          if (item.expiresAt && item.expiresAt < Date.now()) {
            this.deleteData(item.id)
            return false
          }
          return true
        })
        resolve(results)
      }
    })
  }

  /**
   * Delete offline data
   */
  async deleteData(dataId: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['data'], 'readwrite')
      const store = transaction.objectStore('data')
      const request = store.delete(dataId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Cache API response
   */
  async cacheResponse(key: string, data: any, ttl: number = 3600000): Promise<void> {
    if (!this.db) return

    const cacheItem = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.put(cacheItem)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Get cached response
   */
  async getCachedResponse(key: string): Promise<any | null> {
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly')
      const store = transaction.objectStore('cache')
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result && result.expiresAt > Date.now()) {
          resolve(result.data)
        } else {
          if (result) {
            // Clean up expired cache
            this.deleteCachedResponse(key)
          }
          resolve(null)
        }
      }
    })
  }

  /**
   * Delete cached response
   */
  async deleteCachedResponse(key: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite')
      const store = transaction.objectStore('cache')
      const request = store.delete(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Clean up expired data
   */
  async cleanup(): Promise<void> {
    if (!this.db) return

    const now = Date.now()
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000)

    // Clean up old actions
    const actionsTransaction = this.db.transaction(['actions'], 'readwrite')
    const actionsStore = actionsTransaction.objectStore('actions')
    const actionsIndex = actionsStore.index('timestamp')
    const actionsRequest = actionsIndex.openCursor(IDBKeyRange.upperBound(oneWeekAgo))

    actionsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        if (cursor.value.synced) {
          cursor.delete()
        }
        cursor.continue()
      }
    }

    // Clean up expired cache
    const cacheTransaction = this.db.transaction(['cache'], 'readwrite')
    const cacheStore = cacheTransaction.objectStore('cache')
    const cacheRequest = cacheStore.openCursor()

    cacheRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        if (cursor.value.expiresAt < now) {
          cursor.delete()
        }
        cursor.continue()
      }
    }
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage()