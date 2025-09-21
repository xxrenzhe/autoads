/**
 * Common Types
 * Centralized type definitions for shared use across the application
 */

export interface UrlResult {
  url: string;
  valid: boolean;
  error?: string;
  title?: string;
  status?: number;
  loadTime?: number;
  finalUrl?: string;
  proxyStatus?: {
    success: boolean;
    actualIP?: string;
    error?: string;
  };
}

export interface LinkTestResult {
  url: string;
  valid: boolean;
  error?: string;
  title?: string;
  status?: number;
  loadTime?: number;
  finalUrl?: string;
}

export interface BatchResult {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  result?: UrlResult;
  error?: string;
  timestamp: string;
}

export interface ProcessingOptions {
  timeout?: number;
  retries?: number;
  delay?: number;
  concurrency?: number;
  proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  userAgent?: string;
  referer?: string;
}

export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining?: string;
  speed?: string;
}

// SiteRank data structure used by siterank pages
export interface SiteRankData {
  domain: string;
  "Website Url": string;
  rank: number | null;
  priority: number | null;
  commission?: number;
  traffic?: number;
  status: 'pending' | 'completed' | 'error';
  sources?: string[];
}
