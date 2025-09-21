// Storybook 兼容声明（泛型支持）
declare module '@storybook/react' {
  export interface Meta<TArgs = any> {}
  export type StoryObj<TArgs = any> = any
}

