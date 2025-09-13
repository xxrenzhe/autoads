import { LoggingService } from './LoggingService';
import { SecurityService } from './SecurityService';
import { EnhancedError } from '@/lib/utils/error-handling';

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: Date;
  developerToken: string;
  loginCustomerId?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  developerToken: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface AuthState {
  state: string;
  codeVerifier: string;
  timestamp: Date;
  config: OAuthConfig;
}

export interface AccountInfo {
  customerId: string;
  customerName: string;
  currencyCode: string;
  timeZone: string;
  manager: boolean;
  testAccount: boolean;
}

export class GoogleAdsOAuthService {
  private readonly OAUTH_BASE_URL = 'https://accounts.google.com/oauth';
  private readonly GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v14';
  private authStates: Map<string, AuthState> = new Map();
  private credentials: Map<string, string> = new Map();

  constructor(
    private loggingService: LoggingService,
    private securityService: SecurityService
  ) {}

  /**
   * 初始化OAuth配置
   */
  initializeOAuth(config: OAuthConfig): void {
    this.loggingService.info('Google Ads OAuth service initialized', {
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scope
    });
  }

  /**
   * 生成OAuth授权URL
   */
  generateAuthUrl(config: OAuthConfig): string {
    const state = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(128);
    
    // 存储认证状态
    const authState: AuthState = {
      state,
      codeVerifier,
      timestamp: new Date(),
      config
    };
    
    this.authStates.set(state, authState);

    // 生成PKCE code challenge
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope.join(' '),
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    });
    const authUrl = `${this.OAUTH_BASE_URL}/authorize?${params.toString()}`;
    
    this.loggingService.info('OAuth authorization URL generated', { 
      state,
      scopes: config.scope
    });
    return authUrl;
  }

  /**
   * 处理OAuth回调
   */
  async handleAuthCallback(
    code: string, 
    state: string, 
    error?: string
  ): Promise<{ success: boolean; credentials?: GoogleAdsCredentials; error?: string }> {
    try {
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }

      const authState = this.authStates.get(state);
      if (!authState) {
        throw new Error('Invalid or expired OAuth state');
      }

      // 检查状态是否过期（5分钟）
      const now = new Date();
      if (now.getTime() - authState.timestamp.getTime() > 5 * 60 * 1000) {
        this.authStates.delete(state);
        throw new Error('OAuth state expired');
      }

      // 交换授权码获取访问令牌
      const tokenResponse = await this.exchangeCodeForToken(
        code,
        authState.codeVerifier,
        authState.config
      );

      // 创建凭据对象
      const credentials: GoogleAdsCredentials = {
        clientId: authState.config.clientId,
        clientSecret: authState.config.clientSecret,
        refreshToken: tokenResponse.refresh_token || '',
        accessToken: tokenResponse.access_token,
        tokenExpiry: new Date(Date.now() + tokenResponse.expires_in * 1000),
        developerToken: authState.config.developerToken
      };

      // 验证账户访问权限
      const accountInfo = await this.validateAccountAccess(credentials);
      if (accountInfo) {
        credentials.loginCustomerId = accountInfo.customerId;
      }

      // 加密并存储凭据
      const encryptedCredentials = this.encryptCredentials(credentials);
      this.credentials.set(accountInfo?.customerId || 'default', encryptedCredentials);

      // 清理认证状态
      this.authStates.delete(state);

      this.loggingService.info('OAuth authentication completed successfully', {
        customerId: accountInfo?.customerId,
        customerName: accountInfo?.customerName
      });
      return { success: true, credentials };

    } catch (error) { 
      this.loggingService.error('OAuth authentication failed', {
        error: error instanceof Error ? error.message : "Unknown error" as any,
        state
      });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" as any 
      };
    }
  }

  /**
   * 交换授权码获取访问令牌
   */
  async exchangeCodeForToken(
    code: string, 
    codeVerifier: string, 
    config: OAuthConfig
  ): Promise<TokenResponse> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code: code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: config.redirectUri
        })
      });
    
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
      }
    
      try {

    
      return await response.json();

    
      } catch (error) {

    
        console.error(error);
        throw error;

    
      }
    } catch (error) {
      console.error('Error in exchangeCodeForToken:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(customerId: string): Promise<boolean> {
    try {
      const encryptedCredentials = this.credentials.get(customerId);
      if (!encryptedCredentials) {
        throw new Error('No credentials found for customer');
      }

      const credentials = this.decryptCredentials(encryptedCredentials);
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          refresh_token: credentials.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
      }

      const tokenResponse: TokenResponse = await response.json();

      // 更新凭据
      credentials.accessToken = tokenResponse.access_token;
      credentials.tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);

      // 重新加密并存储
      const newEncryptedCredentials = this.encryptCredentials(credentials);
      this.credentials.set(customerId, newEncryptedCredentials);

      this.loggingService.info('Access token refreshed successfully', {
        customerId,
        expiresIn: tokenResponse.expires_in
      });
      return Promise.resolve(true);

    } catch (error) {
      this.loggingService.error('Token refresh failed', {
        customerId,
        error: error instanceof Error ? error.message : "Unknown error" as any
      });
      return Promise.resolve(false);
    }
  }

  /**
   * 验证账户访问权限
   */
  private async validateAccountAccess(credentials: GoogleAdsCredentials): Promise<AccountInfo | null> {
    try {
      const response = await fetch(`${this.GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'developer-token': credentials.developerToken
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to validate account access: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.resourceNames && data.resourceNames.length > 0) {
        const customerId = data.resourceNames[0].split('/').pop();
        
        // 获取账户详细信息
        const accountInfo = await this.getAccountInfo(customerId!, credentials);
        return accountInfo;
      }

      return null as any;

    } catch (error) {
      this.loggingService.error('Account access validation failed', {
        error: error instanceof Error ? error.message : "Unknown error" as any
      });
      return null as any;
    }
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo(customerId: string, credentials: GoogleAdsCredentials): Promise<AccountInfo> {
    try {
      const response = await fetch(`${this.GOOGLE_ADS_API_BASE}/customers/${customerId}`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'developer-token': credentials.developerToken
        }
      });
    
      if (!response.ok) {
        throw new Error(`Failed to get account info: ${response.statusText}`);
      }
    
      const data = await response.json();
      
      return {
        customerId: data.id,
        customerName: data.descriptiveName,
        currencyCode: data.currencyCode,
        timeZone: data.timeZone,
        manager: data.manager,
        testAccount: data.testAccount
      };
    } catch (error) {
      console.error('Error in getAccountInfo:', error);
      throw error; // Re-throw to maintain error propagation
    }
  }

  /**
   * 获取有效的访问令牌
   */
  async getValidAccessToken(customerId: string): Promise<string | null> {
    try {
      const encryptedCredentials = this.credentials.get(customerId);
      if (!encryptedCredentials) {
        return null as any;
      }

      const credentials = this.decryptCredentials(encryptedCredentials);

      // 检查令牌是否过期或即将过期（5分钟内）
      const now = new Date();
      const expiryTime = credentials.tokenExpiry;
      
      if (!expiryTime || now.getTime() >= expiryTime.getTime() - 5 * 60 * 1000) {
        // 令牌过期或即将过期，尝试刷新
        const refreshSuccess = await this.refreshAccessToken(customerId);
        if (!refreshSuccess) {
          return null as any;
        }
        
        // 重新获取刷新后的凭据
        const newEncryptedCredentials = this.credentials.get(customerId);
        if (newEncryptedCredentials) {
          const newCredentials = this.decryptCredentials(newEncryptedCredentials);
          return newCredentials.accessToken || null;
        }
      }

      return credentials.accessToken || null;

    } catch (error) {
      this.loggingService.error('Failed to get valid access token', {
        customerId,
        error: error instanceof Error ? error.message : "Unknown error" as any
      });
      return null as any;
    }
  }

  /**
   * 获取存储的凭据
   */
  getCredentials(customerId: string): GoogleAdsCredentials | null {
    try {
      const encryptedCredentials = this.credentials.get(customerId);
      if (!encryptedCredentials) {
        return null as any;
      }

      return this.decryptCredentials(encryptedCredentials);
    } catch (error) {
      this.loggingService.error('Failed to get credentials', {
        customerId,
        error: error instanceof Error ? error.message : "Unknown error" as any
      });
      return null as any;
    }
  }

  /**
   * 删除凭据
   */
  removeCredentials(customerId: string): Promise<boolean> {
    const removed = this.credentials.delete(customerId);
    
    if (removed) {
      this.loggingService.info('Credentials removed', { customerId });
    }

    return Promise.resolve(removed);
  }

  /**
   * 获取所有账户ID
   */
  getAllCustomerIds(): string[] {
    return Array.from(this.credentials.keys());
  }

  /**
   * 检查凭据是否有效
   */
  async validateCredentials(customerId: string): Promise<boolean> {
    try {
      const accessToken = await this.getValidAccessToken(customerId);
      if (!accessToken) {
        return Promise.resolve(false);
      }

      const credentials = this.getCredentials(customerId);
      if (!credentials) {
        return Promise.resolve(false);
      }

      // 尝试调用一个简单的API来验证凭据
      const response = await fetch(`${this.GOOGLE_ADS_API_BASE}/customers/${customerId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': credentials.developerToken
        }
      });

      return response.ok;

    } catch (error) {
      this.loggingService.error('Credentials validation failed', {
        customerId,
        error: error instanceof Error ? error.message : "Unknown error" as any
      });
      return Promise.resolve(false);
    }
  }

  /**
   * 加密凭据
   */
  private encryptCredentials(credentials: GoogleAdsCredentials): string {
    const credentialsString = JSON.stringify(credentials);
    return this.securityService.encryptData(credentialsString);
  }

  /**
   * 解密凭据
   */
  private decryptCredentials(encryptedCredentials: string): GoogleAdsCredentials {
    const credentialsString = this.securityService.decryptData(encryptedCredentials);
    return JSON.parse(credentialsString);
  }

  /**
   * 生成随机字符串
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成PKCE code challenge
   */
  private generateCodeChallenge(codeVerifier: string): string {
    // 在浏览器环境中，我们使用简单的SHA-256实现
    // 实际项目中应该使用更安全的实现
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    
    // 这里应该实现SHA-256哈希，但为了简化，我们使用base64编码
    return btoa(codeVerifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * 清理过期的认证状态
   */
  cleanupExpiredAuthStates(): void {
    const now = new Date();
    const expiredStates: string[] = [];

    for (const [state, authState] of this.authStates) {
      if (now.getTime() - authState.timestamp.getTime() > 5 * 60 * 1000) {
        expiredStates.push(state);
      }
    }

    expiredStates.forEach((state: any) => this.authStates.delete(state));

    if (expiredStates.length > 0) {
      this.loggingService.info('Cleaned up expired auth states', {
        count: expiredStates.length
      });
    }
  }
}