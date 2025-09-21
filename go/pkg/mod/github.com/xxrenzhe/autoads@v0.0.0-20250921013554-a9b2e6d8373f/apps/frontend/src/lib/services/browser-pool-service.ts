/**
 * Browser Pool Service Stub
 * This is a minimal implementation to resolve import errors
 */

export interface BrowserInstance {
  id: string;
  createdAt: number;
  status: string;
}

export interface BrowserPoolStats {
  totalInstances: number;
  idleInstances: number;
  activeInstances: number;
}

export class BrowserPoolService {
  private instances: BrowserInstance[] = [];

  public getStats(): BrowserPoolStats {
    return {
      totalInstances: this.instances.length,
      idleInstances: this.instances.filter((i: any) => i.status === 'idle').length,
      activeInstances: this.instances.filter((i: any) => i.status === 'active').length,
    };
  }

  public getAllInstances(): BrowserInstance[] {
    return [...this.instances];
  }

  public async closeInstance(id: string): Promise<void> {
    this.instances = this.instances.filter((i: any) => i.id !== id);
  }

  public async publicCleanup(): Promise<number> {
    const beforeCount = this.instances.length;
    this.instances = this.instances.filter((i: any) => i.status === 'idle');
    return beforeCount - this.instances.length;
  }

  public async destroy(): Promise<void> {
    this.instances = [];
  }
}

// Global instance
let browserPoolService: BrowserPoolService | null = null;

export function getBrowserPoolService(): BrowserPoolService {
  if (!browserPoolService) {
    browserPoolService = new BrowserPoolService();
  }
  return browserPoolService;
}

