/**
 * Type safety utilities and type definitions for TypeScript error fixes
 */

// Type definitions for common patterns
export type SafeString = string | undefined;
export type SafeNumber = number | undefined;
export type SafeJson = any;

// User-related type safety
export interface SafeUser {
  name?: string;
  email?: string;
  id: string;
}

// Service status types
export type ServiceStatus = 'healthy' | 'warning' | 'critical';

// Plan features type for safe type assertions
export interface PlanFeatures {
  [key: string]: any;
}

// Notification types
export interface NotificationPayload {
  recipient: string | string[];
  subject?: string;
  message: string;
  type?: string;
}

export interface EmailPayload extends NotificationPayload {
  html?: string;
  attachments?: any[];
}

export interface SMSPayload extends NotificationPayload {
  phone: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}