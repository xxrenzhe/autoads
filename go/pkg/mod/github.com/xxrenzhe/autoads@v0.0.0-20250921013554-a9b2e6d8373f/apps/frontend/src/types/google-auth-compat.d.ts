declare module 'google-auth-library' {
  export class GoogleAuth {
    constructor(options?: any)
  }
  export class OAuth2Client {
    constructor(options?: any)
    getToken(code: string): Promise<{ tokens: any }>
    setCredentials(creds: any): void
    refreshAccessToken(): Promise<{ credentials: any }>
  }
}

