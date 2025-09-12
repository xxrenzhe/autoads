import { createLogger } from "@/lib/utils/security/secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createLogger('EventEmitter');

export type EventListener<T = unknown> = (data: T) => void | Promise<void>;
export type EventFilter<T = unknown> = (data: T) => boolean | Promise<boolean>;

export interface EventSubscription<T = unknown> {
  id: string;
  event: string;
  listener: EventListener<T>;
  filter?: EventFilter<T>;
  once: boolean;
  priority: number;
}

export interface EventMetadata {
  timestamp: number;
  source: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

export interface EventContext<T = unknown> {
  event: string;
  data: T;
  metadata: EventMetadata;
  subscription: EventSubscription<T>;
}

export class EventEmitter {
  private listeners = new Map<string, EventSubscription<any>[]>();
  private globalListeners: EventSubscription<any>[] = [];
  private eventHistory: Array<{ event: string; data: unknown; metadata: EventMetadata }> = [];
  private maxHistorySize: number = 1000;
  private isEmitting = false;
  private pendingEvents: Array<{ event: string; data: unknown; metadata: EventMetadata }> = [];

  constructor(private source: string = 'EventEmitter') {}

  // Event Registration
  on<T = unknown>(
    event: string,
    listener: EventListener<T>,
    options?: {
      filter?: EventFilter<T>;
      priority?: number;
    }
  ): string {
    return this.addListener(event, listener, false, options);
  }

  once<T = unknown>(
    event: string,
    listener: EventListener<T>,
    options?: {
      filter?: EventFilter<T>;
      priority?: number;
    }
  ): string {
    return this.addListener(event, listener, true, options);
  }

  onAny<T = unknown>(
    listener: EventListener<T>,
    options?: {
      filter?: EventFilter<T>;
      priority?: number;
    }
  ): string {
    const subscription: EventSubscription<T> = {
      id: this.generateId(),
      event: '*',
      listener,
      filter: options?.filter,
      once: false,
      priority: options?.priority || 0
    };

    this.globalListeners.push(subscription);
    this.sortListeners(this.globalListeners);
    return subscription.id;
  }

  private addListener<T = unknown>(
    event: string,
    listener: EventListener<T>,
    once: boolean,
    options?: {
      filter?: EventFilter<T>;
      priority?: number;
    }
  ): string {
    const subscription: EventSubscription<T> = {
      id: this.generateId(),
      event,
      listener,
      filter: options?.filter,
      once,
      priority: options?.priority || 0
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(subscription);
    this.sortListeners(this.listeners.get(event)!);
    return subscription.id;
  }

  // Event Emission
  async emit<T = unknown>(
    event: string,
    data: T,
    metadata?: Partial<EventMetadata>
  ): Promise<void> {
    const fullMetadata: EventMetadata = {
      timestamp: Date.now(),
      source: this.source,
      ...metadata
    };

    // Add to history
    this.addToHistory(event, data, fullMetadata);

    // Handle pending events during emission
    if (this.isEmitting) { 
      this.pendingEvents.push({ event, data, metadata: fullMetadata });
      return;
    }

    this.isEmitting = true;

    try {
      await this.processEvent(event, data, fullMetadata);
    } finally {
      this.isEmitting = false;
      await this.processPendingEvents();
    }
  }

  private async processEvent<T = unknown>(
    event: string,
    data: T,
    metadata: EventMetadata
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Process specific event listeners
    const eventListeners = this.listeners.get(event) || [];
    for (const subscription of eventListeners) {
      promises.push(this.executeListener(subscription, event, data, metadata));
    }

    // Process global listeners
    for (const subscription of this.globalListeners) {
      promises.push(this.executeListener(subscription, event, data, metadata));
    }

    await Promise.allSettled(promises);
  }

  private async executeListener<T = unknown>(
    subscription: EventSubscription<T>,
    event: string,
    data: T,
    metadata: EventMetadata
  ): Promise<void> {
    try {
      // Check filter
      if (subscription.filter) {
        const shouldExecute = await subscription.filter(data);
        if (!shouldExecute) {
          return;
        }
      }

      const context: EventContext<T> = {
        event,
        data,
        metadata,
        subscription
      };

      await subscription.listener(data);

      // Remove one-time listeners
      if (subscription.once) {
        this.removeListener(subscription.id);
      }
    } catch (error) {
      logger.error(`Error in event listener for event '${event}':`, new EnhancedError(`Error in event listener for event '${event}'`, { 
        error: error instanceof Error ? error.message : String(error)
      }));
      // Emit error event
      await this.emit('error', { event,
        error: error instanceof Error ? error.message : String(error),
        subscriptionId: subscription.id
      });
    }
  }

    private async processPendingEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    for (const { event, data, metadata } of events) {
      await this.processEvent(event, data, metadata);
    }
  }

  // Event Unregistration
  off(event: string, listener: EventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.findIndex(sub => sub.listener === listener);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  removeListener(subscriptionId: string): boolean {
    // Remove from specific event listeners
    for (const [event, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        listeners.splice(index, 1);
        return true;
      }
    }

    // Remove from global listeners
    const globalIndex = this.globalListeners.findIndex(sub => sub.id === subscriptionId);
    if (globalIndex !== -1) {
      this.globalListeners.splice(globalIndex, 1);
      return true;
    }

    return false;
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.globalListeners = [];
    }
  }

  // Event Querying
  listenerCount(event: string): number {
    const eventListeners = this.listeners.get(event) || [];
    return eventListeners.length;
  }

  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  getListeners(event: string): EventSubscription[] {
    return [...(this.listeners.get(event) || [])];
  }

  // Event History
  getEventHistory(
    filter?: {
      event?: string;
      since?: number;
      limit?: number;
    }
  ): Array<{ event: string; data: unknown; metadata: EventMetadata }> {
    let history = [...this.eventHistory];

    if (filter?.event) {
      history = history.filter(item => item.event === filter.event);
    }

    if (filter?.since) {
      history = history.filter(item => item.metadata.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  private addToHistory(event: string, data: unknown, metadata: EventMetadata): void { 
      this.eventHistory.push({ event, data, metadata });
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  // Utility Methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private sortListeners(listeners: EventSubscription[]): void {
    listeners.sort((a, b) => b.priority - a.priority);
  }

  // Event Patterns
  async waitFor<T = unknown>(
    event: string,
    timeout?: number,
    filter?: EventFilter<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = timeout ? setTimeout(() => {
        this.removeListener(subscriptionId);
        reject(new Error(`Timeout waiting for event '${event}'`));
      }, timeout) : null;

      const subscriptionId = this.once(event, (data: T) => {
        if (timer) clearTimeout(timer);
        resolve(data);
      }, { filter });
    });
  }

  async emitAndWait<T = unknown, R = unknown>(
    event: string,
    data: T,
    responseEvent: string,
    timeout?: number
  ): Promise<R> {
    const responsePromise = this.waitFor<R>(responseEvent, timeout);
    await this.emit(event, data);
    return responsePromise;
  }

  // Event Broadcasting
  async broadcast<T = unknown>(
    events: string[],
    data: T,
    metadata?: Partial<EventMetadata>
  ): Promise<void> {
    const promises = events?.filter(Boolean)?.map(event => this.emit(event, data, metadata));
    await Promise.allSettled(promises);
  }

  // Event Chaining
  async chain<T = unknown>(
    events: Array<{ event: string; data: T; delay?: number }>,
    metadata?: Partial<EventMetadata>
  ): Promise<void> {
    for (const { event, data, delay } of events) {
      await this.emit(event, data, metadata);
      if (delay) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Event Statistics
  getStats(): {
    totalEvents: number;
    totalListeners: number;
    eventCounts: Record<string, number>;
    historySize: number;
  } {
    const eventCounts: Record<string, number> = {};
    let totalListeners = 0;

    for (const [event, listeners] of this.listeners.entries()) {
      eventCounts[event] = listeners.length;
      totalListeners += listeners.length;
    }

    totalListeners += this.globalListeners.length;

    return {
      totalEvents: this.eventHistory.length,
      totalListeners,
      eventCounts,
      historySize: this.eventHistory.length
    };
  }

  // Event Replay
  async replayEvents(
    filter?: {
      event?: string;
      since?: number;
      limit?: number;
    }
  ): Promise<void> {
    const events = this.getEventHistory(filter);
    
    for (const { event, data, metadata } of events) {
      await this.emit(event, data, metadata);
    }
  }
} 