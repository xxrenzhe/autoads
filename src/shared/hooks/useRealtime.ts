"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTenant } from './useTenant';

// WebSocket message types
export interface WebSocketMessage<T = any> {
  type: string;
  payload: T;
  timestamp: number;
  id?: string;
  tenantId?: string;
  userId?: string;
}

// WebSocket connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

// WebSocket event handlers
export interface WebSocketEventHandlers<T = any> {
  onMessage?: (message: WebSocketMessage<T>) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onReconnect?: () => void;
}

// WebSocket configuration
export interface WebSocketConfig {
  url?: string;
  protocols?: string[];
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  timeout?: number;
  debug?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  protocols: [],
  reconnectAttempts: 5,
  reconnectInterval: 3000,
  heartbeatInterval: 30000,
  timeout: 10000,
  debug: false
};

// WebSocket manager class
class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageHandlers = new Map<string, Set<(message: WebSocketMessage) => void>>();
  private eventHandlers: WebSocketEventHandlers = {};
  private status: ConnectionStatus = 'disconnected';
  private tenantId: string | null = null;
  private userId: string | null = null;

  constructor(config: WebSocketConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Set tenant and user context
  setContext(tenantId: string | null, userId: string | null) {
    this.tenantId = tenantId;
    this.userId = userId;
  }

  // Connect to WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('connecting');
      
      try {
        const url = new URL(this.config.url);
        if (this.tenantId) {
          url.searchParams.set('tenantId', this.tenantId);
        }
        if (this.userId) {
          url.searchParams.set('userId', this.userId);
        }

        this.ws = new WebSocket(url.toString(), this.config.protocols);

        const connectTimeout = setTimeout(() => {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          this.setStatus('connected');
          this.reconnectCount = 0;
          this.startHeartbeat();
          this.eventHandlers.onConnect?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          this.stopHeartbeat();
          this.setStatus('disconnected');
          this.eventHandlers.onDisconnect?.();
          
          if (!event.wasClean && this.reconnectCount < this.config.reconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectTimeout);
          this.setStatus('error');
          this.eventHandlers.onError?.(error);
          reject(error);
        };

      } catch (error) {
        this.setStatus('error');
        reject(error);
      }
    });
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setStatus('disconnected');
  }

  // Send message
  send<T = any>(type: string, payload: T): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      if (this.config.debug) {
        console.warn('WebSocket not connected, cannot send message:', { type, payload });
      }
      return false;
    }

    const message: WebSocketMessage<T> = {
      type,
      payload,
      timestamp: Date.now(),
      id: this.generateMessageId(),
      tenantId: this.tenantId || undefined,
      userId: this.userId || undefined
    };

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      if (this.config.debug) {
        console.error('Failed to send WebSocket message:', error);
      }
      return false;
    }
  }

  // Subscribe to message type
  subscribe(messageType: string, handler: (message: WebSocketMessage) => void) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    
    this.messageHandlers.get(messageType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(messageType);
        }
      }
    };
  }

  // Set event handlers
  setEventHandlers(handlers: WebSocketEventHandlers) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Get current status
  getStatus(): ConnectionStatus {
    return this.status;
  }

  // Get connection info
  getConnectionInfo() {
    return {
      status: this.status,
      reconnectCount: this.reconnectCount,
      tenantId: this.tenantId,
      userId: this.userId,
      url: this.config.url
    };
  }

  // Private methods
  private setStatus(status: ConnectionStatus) {
    this.status = status;
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      if (this.config.debug) {
        console.log('WebSocket message received:', message);
      }

      // Handle heartbeat response
      if (message.type === 'pong') {
        return;
      }

      // Dispatch to type-specific handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }

      // Call global message handler
      this.eventHandlers.onMessage?.(message);

    } catch (error) {
      if (this.config.debug) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.setStatus('reconnecting');
    this.reconnectCount++;

    const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectCount - 1);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // Reconnection failed, will try again if under limit
      });
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send('ping', {});
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global WebSocket manager instance
let globalWSManager: WebSocketManager | null = null;

// Main useRealtime hook
export function useRealtime(config: WebSocketConfig = {}) {
  const { tenantId, user } = useTenant();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<Event | null>(null);

  // Initialize WebSocket manager
  const wsManager = useMemo(() => {
    if (!globalWSManager) {
      globalWSManager = new WebSocketManager(config);
    }
    return globalWSManager;
  }, [config]);

  // Update context when tenant or user changes
  useEffect(() => {
    wsManager.setContext(tenantId, user?.id || null);
  }, [wsManager, tenantId, user]);

  // Set up event handlers
  useEffect(() => {
    wsManager.setEventHandlers({
      onConnect: () => setStatus('connected'),
      onDisconnect: () => setStatus('disconnected'),
      onError: (err) => {
        setError(err);
        setStatus('error');
      },
      onReconnect: () => setStatus('connected'),
      onMessage: (message) => setLastMessage(message)
    });
  }, [wsManager]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (tenantId) {
      wsManager.connect().catch(console.error);
    }

    return () => {
      // Don't disconnect on unmount as other components might be using it
      // wsManager.disconnect();
    };
  }, [wsManager, tenantId]);

  // Update status from manager
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(wsManager.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [wsManager]);

  const connect = useCallback(() => {
    return wsManager.connect();
  }, [wsManager]);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, [wsManager]);

  const send = useCallback(<T = any>(type: string, payload: T) => {
    return wsManager.send(type, payload);
  }, [wsManager]);

  const subscribe = useCallback((messageType: string, handler: (message: WebSocketMessage) => void) => {
    return wsManager.subscribe(messageType, handler);
  }, [wsManager]);

  return {
    status,
    lastMessage,
    error,
    connect,
    disconnect,
    send,
    subscribe,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isReconnecting: status === 'reconnecting'
  };
}

// Hook for subscribing to specific message types
export function useRealtimeSubscription<T = any>(
  messageType: string,
  handler: (payload: T) => void,
  deps: React.DependencyList = []
) {
  const { subscribe } = useRealtime();

  useEffect(() => {
    const unsubscribe = subscribe(messageType, (message) => {
      handler(message.payload);
    });

    return unsubscribe;
  }, [subscribe, messageType, ...deps]);
}

// Hook for real-time notifications
export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<WebSocketMessage[]>([]);

  useRealtimeSubscription('notification', (payload) => {
    setNotifications(prev => [...prev, payload]);
  });

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    clearNotifications,
    removeNotification,
    hasUnread: notifications.length > 0
  };
}

// Hook for real-time progress tracking
export function useRealtimeProgress(taskId: string) {
  const [progress, setProgress] = useState<{
    percentage: number;
    status: string;
    message?: string;
    completedAt?: Date;
  } | null>(null);

  useRealtimeSubscription(`progress:${taskId}`, (payload) => {
    setProgress(payload);
  }, [taskId]);

  return progress;
}