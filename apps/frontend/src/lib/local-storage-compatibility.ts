/**
 * LocalStorage compatibility layer for AdsCenter services
 * Provides the old array-based API using the new key-value LocalStorageService
 */

import { globalLocalStorageService } from '@/lib/local-storage-service';

export interface StorageItem {
  id: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

export class LocalStorageCompatibility {
  /**
   * Get all items from storage (array-based)
   */
  async getAll(key: string): Promise<StorageItem[]> {
    try {
      return globalLocalStorageService.get<StorageItem[]>(key, []) || [];
    } catch (error) {
      console.error('Failed to get items from storage:', error);
      return [];
    }
  }

  /**
   * Get item by ID
   */
  async getById(key: string, id: string): Promise<StorageItem | null> {
    try {
      const items = await this.getAll(key);
      return items.find((item: any) => item.id === id) || null;
    } catch (error) {
      console.error('Failed to get item by ID:', error);
      return null as any;
    }
  }

  /**
   * Create new item
   */
  async create(key: string, data: any): Promise<StorageItem> {
    try {
      const items = await this.getAll(key);
      const item: StorageItem = {
        id: this.generateId(),
        data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      items.push(item);
      globalLocalStorageService.set(key, items);
      
      return item;
    } catch (error) {
      console.error('Failed to create item:', error);
      throw error;
    }
  }

  /**
   * Update item
   */
  async update(key: string, id: string, data: any): Promise<StorageItem | null> {
    try {
      const items = await this.getAll(key);
      const index = items.findIndex(item => item.id === id);
      
      if (index === -1) {
        return null as any;
      }

      items[index] = {
        ...items[index],
        data,
        updatedAt: new Date().toISOString()
      };

      globalLocalStorageService.set(key, items);
      return items[index];
    } catch (error) {
      console.error('Failed to update item:', error);
      throw error;
    }
  }

  /**
   * Delete item
   */
  async delete(key: string, id: string): Promise<boolean> {
    try {
      const items = await this.getAll(key);
      const filteredItems = items.filter((item: any) => item.id !== id);
      
      if (filteredItems.length === items.length) {
        return false;
      }

      globalLocalStorageService.set(key, filteredItems);
      return true;
    } catch (error) {
      console.error('Failed to delete item:', error);
      return false;
    }
  }

  /**
   * Query items with filter
   */
  async query(key: string, filter?: (item: StorageItem) => boolean): Promise<StorageItem[]> {
    try {
      const items = await this.getAll(key);
      return filter ? items.filter(filter) : items;
    } catch (error) {
      console.error('Failed to query items:', error);
      return [];
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const localStorageCompatibility = new LocalStorageCompatibility();
