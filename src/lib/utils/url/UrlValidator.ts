/**
 * URL validation and processing utilities
 */
export class UrlValidator {
  /**
   * Validate if a string is a valid URL
   */
  static isValid(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Extract domain from URL with enhanced redirect handling
   */
  static extractDomain(url: string): string {
    if (!url || typeof url !== "string") return "";

    let cleanUrl = url.trim();

    // Handle redirect patterns (from siterank/utils.ts)
    const redirectPatterns = [
      /[?&]url=([^&]+)/i,
      /[?&]redirect=([^&]+)/i,
      /[?&]target=([^&]+)/i,
      /[?&]destination=([^&]+)/i,
    ];

    for (const pattern of redirectPatterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1]) {
        cleanUrl = decodeURIComponent(match[1]);
        break;
      }
    }

    try {
      const urlWithProtocol = cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`;
      const urlObj = new URL(urlWithProtocol);
      const domain = urlObj.hostname.replace(/^www\./, "");
      return domain && domain.includes(".") && !domain.includes(" ") ? domain : url;
    } catch {
      // Fallback parsing
      const fallbackDomain = cleanUrl
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .split("?")[0]
        .split("#")[0];
      return fallbackDomain && fallbackDomain.includes(".") && !fallbackDomain.includes(" ") ? fallbackDomain : url;
    }
  }

  /**
   * Ensure URL has https protocol
   */
  static ensureHttps(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://${url}`;
  }

  /**
   * Normalize URL for comparison
   */
  static normalize(url: string): string {
    return this.ensureHttps(url).trim().replace(/\/+$/, '');
  }

  /**
   * Validate and clean URL (from batch-open/utils.ts)
   */
  static validateAndClean(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null as any;
    
    const normalized = this.ensureHttps(trimmed);
    return this.isValid(normalized) ? normalized : null;
  }
}