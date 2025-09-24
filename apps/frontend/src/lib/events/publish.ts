// apps/frontend/src/lib/events/publish.ts
// Frontend (Next.js on Cloud Run) should not directly depend on GCP SDKs.
// This module provides a safe, lightweight publisher that:
// - In production: best-effort POST to unified backend gateway if configured
// - Otherwise: no-op with logging
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('EVENT-PUBLISHER');

const BACKEND_BASE = process.env.BACKEND_URL || '';

export async function publishEvent(eventType: string, payload: object) {
  try {
    // Prefer delegating to backend if BACKEND_URL is available (e.g., API Gateway)
    if (BACKEND_BASE) {
      const url = new URL('/api/events/publish', BACKEND_BASE).toString();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventType, payload }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.warn(`Gateway publish non-OK: ${res.status} ${text}`);
      } else {
        logger.info(`Event '${eventType}' forwarded to backend gateway.`);
      }
      return;
    }

    // Fallback: log only (no-op)
    logger.warn(`No BACKEND_URL configured; '${eventType}' event not published.`);
  } catch (error) {
    logger.error(`Failed to publish event '${eventType}':`, error);
    // Swallow to avoid breaking UX; server-side processors own reliability
  }
}
