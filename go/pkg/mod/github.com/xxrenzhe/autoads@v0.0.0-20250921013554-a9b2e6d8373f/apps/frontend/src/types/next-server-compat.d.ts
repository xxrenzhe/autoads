// Next.js 兼容类型（仅用于通过 TS 编译，不影响运行时）
declare module 'next/server' {
  // 以合并声明的方式增强 Next 类型（不覆盖官方定义）
  export class NextResponse extends Response {
    static json(data?: any, init?: any): NextResponse
    static redirect(input?: any, init?: any): NextResponse
    static next(init?: any): NextResponse
  }
  export interface NextRequest extends Request {
    nextUrl: any
    ip?: string | null
    cookies: any
    clone(): NextRequest
    json(): Promise<any>
    formData(): Promise<any>
    text(): Promise<string>
    signal: any
  }
}
