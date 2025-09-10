/**
 * Repository factory for creating repository instances
 */
export class RepositoryFactory {
  static create<T>(repositoryClass: new (...args: any[]) => T, ...args: any[]): T {
    return new repositoryClass(...args)
  }
}
