/**
 * Unified Logger Interface
 * Export the primary logger implementation for consistent usage
 */

export { createLogger } from '@/lib/utils/security/secure-logger';
export { createCategoryLogger } from '@/lib/utils/centralized-logging';

// Re-export types for convenience
export type { ILogger as Logger } from '@/lib/core/types'
