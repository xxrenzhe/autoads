/**
 * Connection Pool Manager for managing persistent connections
 * Helps prevent connection leaks and manages connection health
 */

export interface ConnectionConfig {
  maxConnections: number;
  idleTimeout: number;
  acquireTimeout: number;
  createTimeout: number;
  destroyTimeout: number;
  healthCheckInterval: number;
}

export interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  pending: number;
  destroyed: number;
}

export interface ConnectionInfo {
  id: string;
  created: number;
  lastUsed: number;
  state: 'active' | 'idle' | 'pending' | 'destroyed';
  resource: any;
}

/**
 * Connection Pool Manager
 */
export class ConnectionPool<T = any> {
  private config: ConnectionConfig;
  private connections: Map<string, ConnectionInfo> = new Map();
  private pendingQueue: Array<{ resolve: Function; reject: Function }> = [];
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private stats: ConnectionStats = {
    total: 0,
    active: 0,
    idle: 0,
    pending: 0,
    destroyed: 0
  };
  
  constructor(
    private createConnection: () => Promise<T>,
    private destroyConnection: (resource: T) => Promise<void>,
    private healthCheck?: (resource: T) => Promise<boolean>,
    config: Partial<ConnectionConfig> = {}
  ) {
    this.config = {
      maxConnections: 10,
      idleTimeout: 30000, // 30 seconds
      acquireTimeout: 5000, // 5 seconds
      createTimeout: 10000, // 10 seconds
      destroyTimeout: 5000, // 5 seconds
      healthCheckInterval: 60000, // 1 minute
      ...config
    };
    
    this.startHealthChecks();
    this.startCleanup();
  }
  
  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pendingQueue.findIndex(item => item.resolve === resolve);
        if (index > -1) {
          this.pendingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeout);
      
      this.pendingQueue.push({
        resolve: (resource: T) => {
          clearTimeout(timeout);
          resolve(resource);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }
  
  /**
   * Release a connection back to the pool
   */
  async release(resource: T): Promise<void> {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.resource === resource);
    
    if (!connection) {
      // Connection not found in pool, destroy it
      try {
        await this.destroyConnection(resource);
      } catch (error) {
        console.error('Error destroying unknown connection:', error);
      }
      return;
    }
    
    if (connection.state === 'active') {
      connection.state = 'idle';
      connection.lastUsed = Date.now();
      this.updateStats();
      
      // Process queue in case someone is waiting
      this.processQueue();
    }
  }
  
  /**
   * Process the pending queue
   */
  private async processQueue(): Promise<void> {
    if (this.pendingQueue.length === 0) return;
    
    // Try to find an idle connection
    const idleConnection = Array.from(this.connections.values())
      .find(conn => conn.state === 'idle');
    
    if (idleConnection) {
      const pending = this.pendingQueue.shift();
      if (pending) {
        idleConnection.state = 'active';
        idleConnection.lastUsed = Date.now();
        this.updateStats();
        pending.resolve(idleConnection.resource);
      }
      return;
    }
    
    // Create new connection if under limit
    if (this.stats.active < this.config.maxConnections) {
      const pending = this.pendingQueue.shift();
      if (pending) {
        this.createAndAssign(pending);
      }
    }
  }
  
  /**
   * Create a new connection and assign to pending request
   */
  private async createAndAssign(pending: { resolve: Function; reject: Function }): Promise<void> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const timeout = setTimeout(() => {
        throw new Error('Connection create timeout');
      }, this.config.createTimeout);
      
      const resource = await this.createConnection();
      clearTimeout(timeout);
      
      const connection: ConnectionInfo = {
        id: connectionId,
        created: Date.now(),
        lastUsed: Date.now(),
        state: 'active',
        resource
      };
      
      this.connections.set(connectionId, connection);
      this.updateStats();
      
      pending.resolve(resource);
    } catch (error) {
      pending.reject(error);
    }
  }
  
  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (!this.healthCheck) return;
    
    this.healthCheckTimer = setInterval(async () => {
      const connections = Array.from(this.connections.values())
        .filter(conn => conn.state === 'idle');
      
      for (const connection of connections) {
        try {
          const isHealthy = await this.healthCheck!(connection.resource);
          if (!isHealthy) {
            await this.destroyConnectionInfo(connection);
          }
        } catch (error) {
          console.error('Health check failed for connection:', connection.id, error);
          await this.destroyConnectionInfo(connection);
        }
      }
    }, this.config.healthCheckInterval);
  }
  
  /**
   * Start cleanup of idle connections
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const idleConnections = Array.from(this.connections.values())
        .filter(conn => 
          conn.state === 'idle' && 
          now - conn.lastUsed > this.config.idleTimeout
        );
      
      idleConnections.forEach(connection => {
        this.destroyConnectionInfo(connection);
      });
    }, this.config.idleTimeout / 2); // Check twice as often as timeout
  }
  
  /**
   * Destroy a connection
   */
  private async destroyConnectionInfo(connection: ConnectionInfo): Promise<void> {
    try {
      const timeout = setTimeout(() => {
        throw new Error('Connection destroy timeout');
      }, this.config.destroyTimeout);
      
      await this.destroyConnection(connection.resource);
      clearTimeout(timeout);
      
      this.connections.delete(connection.id);
      connection.state = 'destroyed';
      this.updateStats();
      
      // Try to create a new connection if there are pending requests
      if (this.pendingQueue.length > 0 && this.stats.active < this.config.maxConnections) {
        const pending = this.pendingQueue.shift();
        if (pending) {
          this.createAndAssign(pending);
        }
      }
    } catch (error) {
      console.error('Error destroying connection:', connection.id, error);
    }
  }
  
  /**
   * Update connection statistics
   */
  private updateStats(): void {
    this.stats = {
      total: this.connections.size,
      active: Array.from(this.connections.values()).filter(c => c.state === 'active').length,
      idle: Array.from(this.connections.values()).filter(c => c.state === 'idle').length,
      pending: this.pendingQueue.length,
      destroyed: this.stats.destroyed
    };
  }
  
  /**
   * Get current pool statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }
  
  /**
   * Get detailed connection information
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }
  
  /**
   * Drain the pool (destroy all connections)
   */
  async drain(): Promise<void> {
    // Stop timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Reject all pending requests
    const pendingRequests = [...this.pendingQueue];
    this.pendingQueue.length = 0;
    pendingRequests.forEach(pending => {
      pending.reject(new Error('Pool is draining'));
    });
    
    // Destroy all connections
    const destroyPromises = Array.from(this.connections.values())
      ?.filter(Boolean)?.map(connection => this.destroyConnectionInfo(connection));
    
    await Promise.allSettled(destroyPromises);
  }
}

/**
 * Factory function to create connection pools
 */
export function createConnectionPool<T>(
  createConnection: () => Promise<T>,
  destroyConnection: (resource: T) => Promise<void>,
  healthCheck?: (resource: T) => Promise<boolean>,
  config?: Partial<ConnectionConfig>
): ConnectionPool<T> {
  return new ConnectionPool(createConnection, destroyConnection, healthCheck, config);
}

// Default export
export default ConnectionPool;