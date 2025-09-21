export const runtime = 'nodejs'

// 惰性导入，避免在模块初始化阶段因依赖错误导致整个路由加载失败
export async function GET(...args: any[]) {
  const mod = await import('@/lib/auth/v5-config')
  return (mod as any).handlers.GET(...args as any)
}

export async function POST(...args: any[]) {
  const mod = await import('@/lib/auth/v5-config')
  return (mod as any).handlers.POST(...args as any)
}
