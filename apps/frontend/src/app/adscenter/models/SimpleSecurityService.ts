/**
 * 简化的安全服务 - 用于构建过程
 */

export class SimpleSecurityService {
  private initialized = false;

  async initializeKey(password: string): Promise<void> {
    this.initialized = true;
  }

  async encryptSensitiveData(data: string): Promise<string> {
    // 简化实现用于构建
    return `encrypted_${data}`;
  }

  async decryptSensitiveData(encrypted: any): Promise<string> {
    // 简化实现用于构建
    if (typeof encrypted === 'string' && encrypted.startsWith('encrypted_')) {
      return encrypted.substring(10);
    }
    return String(encrypted);
  }
}

export const securityService = new SimpleSecurityService();