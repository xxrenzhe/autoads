// 扩展 Next.js Request 类型，增加可选的 ip 字段
declare module 'next/server' {
  interface NextRequest {
    ip?: string | null
  }
}

