declare module 'jsonwebtoken' {
  export type Algorithm = any
  export class JsonWebTokenError extends Error { constructor(msg?: string) }
  export class TokenExpiredError extends Error { expiredAt?: Date; constructor(msg?: string, expiredAt?: Date) }
  const jwt: {
    sign: any
    verify: any
    decode: any
    JsonWebTokenError: typeof JsonWebTokenError
    TokenExpiredError: typeof TokenExpiredError
  }
  export default jwt
}

