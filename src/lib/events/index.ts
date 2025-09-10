/**
 * Simple Event System
 * 简化的事件系统
 * 
 * This module provides a simple event system based on Node.js EventEmitter.
 * The complex event-driven architecture has been removed for simplicity.
 */

// Re-export simple event bus
export { eventBus, EventTypes, emitApiCall, emitTokenConsumed, emitFeatureUsage } from '../simple-event-bus';

// Event types and interfaces
export interface ApiCallEvent {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  feature?: 'siterank' | 'batchopen' | 'adscenter';
}

export interface TokenConsumedEvent {
  userId: string;
  amount: number;
  feature: 'siterank' | 'batchopen' | 'adscenter';
  endpoint: string;
}

export interface FeatureUsageEvent {
  userId: string;
  feature: 'siterank' | 'batchopen' | 'adscenter';
  endpoint: string;
}