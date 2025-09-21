// Minimal Zod compatibility declarations to satisfy TS without full zod install
declare module 'zod' {
  export type ZodSchema<T = any> = any
  export class ZodError extends Error { errors: any[] }
  export const z: any
}
