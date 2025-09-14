import type { Meta, StoryObj } from '@storybook/react';

const fn = () => {};

import { Header } from './Header';

const meta: any = {
  title: 'Example/Header',
  component: Header,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
  args: {
    onLogin: fn,
    onLogout: fn,
    onCreateAccount: fn,
  },
} as const;

export default meta;
type Story = any;

export const LoggedIn: Story = {
  args: {
    user: {
      name: 'Jane Doe',
    },
  },
};

export const LoggedOut: Story = {};
