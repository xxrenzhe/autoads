// Frontend no longer connects DB directly. Export a prisma-compatible stub to keep builds passing.
type AnyFn = (...args: any[]) => any

function thrower(path: string): AnyFn {
  return () => {
    throw new Error(`Prisma call '${path}' is disabled in frontend. Use BFF (/api/go/*) instead.`)
  }
}

export const prisma: any = new Proxy(
  {},
  {
    get(_t, model: string) {
      return new Proxy(
        {},
        {
          get(_mt, method: string) {
            return thrower(`${String(model)}.${String(method)}`)
          },
        },
      )
    },
  },
)
// No enum re-exports; use string literals where needed
