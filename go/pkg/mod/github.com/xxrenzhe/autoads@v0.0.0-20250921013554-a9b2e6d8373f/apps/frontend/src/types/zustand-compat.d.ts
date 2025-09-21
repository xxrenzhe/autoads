// Minimal ambient type declarations for Zustand and its middlewares
// to satisfy TypeScript in environments where full types may be unavailable.

declare module 'zustand' {
  export type StateCreator<TState, Mps = [], Mds = []> = (...args: any[]) => TState;
  export function create<TState>(): (
    initializer: StateCreator<TState, any, any>,
    ...rest: any[]
  ) => any;
}

declare module 'zustand/middleware' {
  export function devtools<T extends (...args: any[]) => any>(fn: T, options?: any): T;
  export function persist<T extends (...args: any[]) => any>(fn: T, options?: any): T;
  export function subscribeWithSelector<T extends (...args: any[]) => any>(fn: T): T;
}

declare module 'zustand/middleware/immer' {
  export function immer<T extends (...args: any[]) => any>(fn: T): T;
}

