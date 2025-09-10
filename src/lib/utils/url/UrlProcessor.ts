/**
 * URL processing utilities
 */
import { UrlValidator } from './UrlValidator';

export class UrlProcessor {
  /**
   * Process a batch of URLs
   */
  static processBatch(urls: string[], options: {
    removeDuplicates?: boolean;
    validate?: boolean;
    normalize?: boolean;
    limit?: number;
  } = {}): string[] {
    let processed = [...urls];

    // Remove empty strings
    processed = processed.filter(url => url && url.trim());

    // Normalize URLs
    if (options.normalize) {
      processed = processed?.filter(Boolean)?.map(url => UrlValidator.normalize(url));
    }

    // Validate URLs
    if (options.validate) {
      processed = processed.filter(url => UrlValidator.isValid(url));
    }

    // Remove duplicates
    if (options.removeDuplicates) {
      processed = [...new Set(processed)];
    }

    // Apply limit
    if (options.limit && processed.length > options.limit) {
      processed = processed.slice(0, options.limit);
    }

    return processed;
  }

  /**
   * Extract URLs from text
   */
  static extractFromText(text: string): string[] {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    const matches = text.match(urlRegex);
    return matches || [];
  }

  /**
   * Group URLs by domain
   */
  static groupByDomain(urls: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    
    urls.forEach(url => {
      const domain = UrlValidator.extractDomain(url);
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(url);
    });

    return groups;
  }
}