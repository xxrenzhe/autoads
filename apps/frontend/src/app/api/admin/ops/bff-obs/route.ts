export const dynamic = 'force-dynamic'

export async function GET() {
  const g: any = globalThis as any
  const data = Array.isArray(g.__bff_obs) ? g.__bff_obs.slice(-100).reverse() : []
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })
}

