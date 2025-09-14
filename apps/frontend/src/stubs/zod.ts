// Minimal stub for 'zod' providing chaining APIs used at runtime
type AnySchema = {
  min: (...args: any[]) => AnySchema
  max: (...args: any[]) => AnySchema
  default: (...args: any[]) => AnySchema
  optional: () => AnySchema
  coerce?: any
}

const makeSchema = (): AnySchema => {
  const self: any = {}
  self.min = () => self
  self.max = () => self
  self.default = () => self
  self.optional = () => self
  return self
}

export const z: any = {
  string: () => makeSchema(),
  number: () => makeSchema(),
  enum: (_values: readonly string[]) => makeSchema(),
  object: (_shape: Record<string, any>) => ({
    parse: (input: any) => input,
  }),
  coerce: {
    number: () => makeSchema(),
  },
}

export default { z }

